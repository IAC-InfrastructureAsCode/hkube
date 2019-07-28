const Logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
const stateManager = require('./states/stateManager');
const jobConsumer = require('./consumer/JobConsumer');
const algoRunnerCommunication = require('./algorithm-communication/workerCommunication');
const discovery = require('./states/discovery');
const { stateEvents, EventMessages, workerStates, workerCommands, Components } = require('../lib/consts');
const kubernetes = require('./helpers/kubernetes');
const messages = require('./algorithm-communication/messages');
const subPipeline = require('./subpipeline/subpipeline');
const execAlgorithms = require('./algorithm-execution/algorithm-execution');

const ALGORITHM_CONTAINER = 'algorunner';
const component = Components.WORKER;
const DEFAULT_STOP_TIMEOUT = 5000;
let log;

class Worker {
    constructor() {
        this._stopTimeout = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._inTerminationMode = false;
        this._options = options;
        this._debugMode = options.debugMode;
        this._registerToConnectionEvents();
        this._registerToCommunicationEvents();
        this._registerToStateEvents();
        this._registerToEtcdEvents();
        this._stopTimeoutMs = options.timeouts.stop || DEFAULT_STOP_TIMEOUT;
        this._setInactiveTimeout();
    }

    _setInactiveTimeout() {
        if (jobConsumer.isConsumerPaused) {
            this._inactiveTimeoutMs = this._options.timeouts.inactivePaused || 0;
        }
        else {
            this._inactiveTimeoutMs = this._options.timeouts.inactive || 0;
        }
        this._handleTimeout(stateManager.state);
    }

    _registerToEtcdEvents() {
        discovery.on(EventMessages.STOP, async (res) => {
            log.info(`got stop: ${res.reason}`, { component });
            const reason = `parent pipeline stopped: ${res.reason}`;
            const { jobId } = jobConsumer.jobData;
            await this._stopAllPipelinesAndExecutions({ jobId, reason });
            stateManager.stop();
        });
        discovery.on(workerCommands.coolDown, async () => {
            log.info('got coolDown event', { component });
            jobConsumer.hotWorker = false;
            await jobConsumer.updateDiscovery({ state: stateManager.state });
            this._setInactiveTimeout();
        });
        discovery.on(workerCommands.warmUp, async () => {
            log.info('got warmUp event', { component });
            jobConsumer.hotWorker = true;
            await jobConsumer.updateDiscovery({ state: stateManager.state });
            this._setInactiveTimeout();
        });
        discovery.on(workerCommands.stopProcessing, async () => {
            if (!jobConsumer.isConsumerPaused) {
                await jobConsumer.pause();
                await jobConsumer.updateDiscovery({ state: stateManager.state });
                this._setInactiveTimeout();
            }
        });
        discovery.on(workerCommands.startProcessing, async () => {
            if (stateManager.state === workerStates.exit) {
                return;
            }
            if (jobConsumer.isConsumerPaused) {
                await jobConsumer.resume();
                await jobConsumer.updateDiscovery({ state: stateManager.state });
                this._setInactiveTimeout();
            }
        });
    }

    _registerToConnectionEvents() {
        algoRunnerCommunication.on('connection', () => {
            stateManager.isConnected = true;
        });
        algoRunnerCommunication.on('disconnect', async (reason) => {
            stateManager.isConnected = false;
            if (stateManager.state === workerStates.exit) {
                return;
            }
            await this.algorithmDisconnect(reason);
        });
        stateManager.on('disconnect', async (reason) => {
            await this.algorithmDisconnect(reason);
        });
    }

    /**
     * Register to algoRunner messages.
     */
    _registerToCommunicationEvents() {
        algoRunnerCommunication.on(messages.incomming.initialized, () => {
            if (stateManager._stateMachine.cannot('start')) {
                log.warning(`${messages.incomming.initialized} can be called only as a response to ${messages.outgoing.initialize}`, { component });
                return;
            }
            if (stateManager.state !== workerStates.init) {
                log.warning(`${messages.incomming.initialized} can be called only as a response to ${messages.outgoing.initialize}`, { component });
                return;
            }
            stateManager.start();
        });
        algoRunnerCommunication.on(messages.incomming.done, (message) => {
            if (stateManager.state !== workerStates.working) {
                log.warning(`${messages.incomming.done} can be called only as a response to ${messages.outgoing.start}`, { component });
                return;
            }
            stateManager.done(message);
        });
        algoRunnerCommunication.on(messages.incomming.stopped, (message) => {
            if (stateManager.state !== workerStates.stop) {
                log.warning(`${messages.incomming.done} can be called only as a response to ${messages.outgoing.stop}`, { component });
                return;
            }
            if (this._stopTimeout) {
                clearTimeout(this._stopTimeout);
            }
            stateManager.done(message);
        });
        algoRunnerCommunication.on(messages.incomming.progress, (message) => {
            if (message.data) {
                log.debug(`progress: ${message.data.progress}`, { component });
            }
        });
        algoRunnerCommunication.on(messages.incomming.error, async (message) => {
            if (stateManager.state !== workerStates.working && stateManager.state !== workerStates.init) {
                log.warning(`${messages.incomming.error} can be called only as a response to ${messages.outgoing.initialize}/${messages.outgoing.start}`, { component });
                return;
            }
            const errText = message.error && message.error.message;
            log.error(`got error from algorithm: ${errText}`, { component });
            stateManager.done(message);
        });
        algoRunnerCommunication.on(messages.incomming.startSpan, (message) => {
            this._startAlgorithmSpan(message);
        });
        algoRunnerCommunication.on(messages.incomming.finishSpan, (message) => {
            this._finishAlgorithmSpan(message);
        });
    }

    async _stopAllPipelinesAndExecutions({ jobId, reason }) {
        await Promise.all([
            subPipeline.stopAllSubPipelines({ reason }),
            execAlgorithms.stopAllExecutions({ jobId })
        ]);
    }

    async algorithmDisconnect(reason) {
        if (this._debugMode) {
            return;
        }
        const type = jobConsumer.getAlgorithmType();
        const containerStatus = await kubernetes.getPodContainerStatus(this._options.kubernetes.pod_name, ALGORITHM_CONTAINER);
        const defaultMessage = `algorithm ${type} has disconnected, reason: ${reason}`;
        const message = {
            error: {
                reason: containerStatus && containerStatus.reason,
                message: `${defaultMessage}. ${(containerStatus && containerStatus.message)}`
            }
        };
        log.error(message.error.message, { component });
        stateManager.exit(message);
    }

    /**
     * Ensure worker is in 'working' state
     * @param {string} operation operation for which this validation is requested
     * @returns true if in 'working' state, else false
     */
    _validateWorkingState(operation) {
        if (stateManager.state === workerStates.working) {
            return true;
        }
        log.warning(`cannot ${operation} if not in working state`, { component });
        return false;
    }

    /**
     * Start new algorithm span
     * @param message startSpan message
     * @param message.data.name span name
     * @param message.data.tags tags object to be added to span (optional)
     */
    _startAlgorithmSpan(message) {
        if (!this._validateWorkingState('startSpan for algorithm')) {
            return;
        }
        const { data } = message;
        if (!data || !data.name) {
            log.error(`invalid startSpan message: ${JSON.stringify(message, 2, null)}`);
            return;
        }
        const spanOptions = {
            name: data.name,
            id: jobConsumer.taskId,
            tags: {
                ...data.tags,
                jobId: jobConsumer.jobId,
                taskId: jobConsumer.taskId,
            }
        };
        // set parent span
        if (!jobConsumer.algTracer.topSpan(jobConsumer.taskId)) {
            const topWorkerSpan = tracer.topSpan(jobConsumer.taskId);
            if (topWorkerSpan) {
                spanOptions.parent = topWorkerSpan.context();
            }
            else {
                spanOptions.parent = jobConsumer._job.data.spanId;
            }
        }
        // start span
        jobConsumer.algTracer.startSpan(spanOptions);
    }

    /**
     * Finish algorithm span
     * @param message finishSpan message
     * @param message.data.error error message (optional)
     * @param message.data.tags tags object to be added to span (optional)
     */
    _finishAlgorithmSpan(message) {
        if (!this._validateWorkingState('finishSpan for algorithm')) {
            return;
        }
        const { data } = message;
        if (!data) {
            log.warning(`invalid finishSpan message: ${JSON.stringify(message, 2, null)}`);
            return;
        }
        const topSpan = jobConsumer.algTracer.topSpan(jobConsumer.taskId);
        if (topSpan) {
            if (data.tags) {
                topSpan.addTag(data.tags);
            }
            topSpan.finish(data.error);
        }
        else {
            log.warning('got finishSpan request but algorithm span stack is empty!');
        }
    }

    async handleExit(code, jobId) {
        if (!this._inTerminationMode) {
            this._inTerminationMode = true;
            try {
                log.info(`starting termination mode. Exiting with code ${code}`, { component });
                const reason = 'parent pipeline exit';
                if (jobId) {
                    await this._stopAllPipelinesAndExecutions({ jobId, reason });
                }

                algoRunnerCommunication.send({ command: messages.outgoing.exit });
                const terminated = await kubernetes.waitForTerminatedState(this._options.kubernetes.pod_name, ALGORITHM_CONTAINER);
                if (terminated) {
                    log.info(`algorithm container terminated. Exiting with code ${code}`, { component });
                }
                else { // if not terminated, kill job
                    const jobName = await kubernetes.getJobForPod(this._options.kubernetes.pod_name);
                    if (jobName) {
                        await kubernetes.deleteJob(jobName);
                        log.info(`deleted job ${jobName}`, { component });
                    }
                }
            }
            catch (error) {
                log.error(`failed to handle exit: ${error}`, { component });
            }
            finally {
                this._inTerminationMode = false;
                process.exit(code);
            }
        }
    }

    _handleTimeout(state) {
        if (state === workerStates.ready) {
            if (this._inactiveTimer) {
                clearTimeout(this._inactiveTimer);
                this._inactiveTimer = null;
            }
            if (!jobConsumer.hotWorker && this._inactiveTimeoutMs != 0) { // eslint-disable-line
                log.info(`starting inactive timeout for worker ${this._inactiveTimeoutMs / 1000} seconds`, { component });
                this._inactiveTimer = setTimeout(() => {
                    if (!this._inTerminationMode) {
                        log.info(`worker is inactive for more than ${this._inactiveTimeoutMs / 1000} seconds.`, { component });
                        stateManager.exit();
                    }
                }, this._inactiveTimeoutMs);
            }
        }
        else if (this._inactiveTimer) {
            log.info(`worker is active (${state}). Clearing inactive timeout`, { component });
            clearTimeout(this._inactiveTimer);
            this._inactiveTimer = null;
        }
    }

    _registerToStateEvents() {
        stateManager.on(stateEvents.stateEntered, async ({ job, state, results }) => {
            const { jobId } = jobConsumer.jobData || {};
            let pendingTransition = null;
            let reason = null;
            log.info(`Entering state: ${state}`, { component });
            const result = { state, results };
            this._handleTimeout(state);
            switch (state) {
                case workerStates.exit:
                    await jobConsumer.finishJob(result);
                    this.handleExit(0, jobId);
                    break;
                case workerStates.results:
                    if (jobId) {
                        reason = `parent algorithm entered state ${state}`;
                        await this._stopAllPipelinesAndExecutions({ jobId, reason });
                    }
                    await jobConsumer.finishJob(result);
                    pendingTransition = stateManager.cleanup.bind(stateManager);
                    break;
                case workerStates.ready:
                    break;
                case workerStates.init: {
                    const { error, data } = await jobConsumer.extractData(job.data);
                    if (!error) {
                        algoRunnerCommunication.send({
                            command: messages.outgoing.initialize,
                            data
                        });
                    }
                    break;
                }
                case workerStates.working:
                    algoRunnerCommunication.send({
                        command: messages.outgoing.start
                    });
                    break;
                case workerStates.shutdown:
                    break;
                case workerStates.error:
                    break;
                case workerStates.stop:
                    this._stopTimeout = setTimeout(() => {
                        log.error('Timeout exceeded trying to stop algorithm.', { component });
                        stateManager.done('Timeout exceeded trying to stop algorithm');
                        this.handleExit(0, jobId);
                    }, this._stopTimeoutMs);
                    algoRunnerCommunication.send({
                        command: messages.outgoing.stop
                    });
                    break;
                default:
            }
            await jobConsumer.updateDiscovery(result);
            if (pendingTransition) {
                pendingTransition();
            }
        });
    }
}

module.exports = new Worker();
