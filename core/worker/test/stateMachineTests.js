const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');

const stateMachine = require('../lib/states/stateManager');
const { stateEvents } = require('../common/consts/events');
const delay = require('await-delay');
const { workerStates } = require('../common/consts/states');
const { expect } = require('chai');
const sinon = require('sinon');
const bootstrap = require('../bootstrap');
const Etcd = require('@hkube/etcd');
const jobConsumer = require('../lib/consumer/JobConsumer');
let log;
let etcd;

describe('state machine', () => {
    before(async () => {
        await bootstrap.init();
        const { main, logger } = await configIt.load();
        log = new Logger(main.serviceName, logger);
        etcd = new Etcd();
        etcd.init({ etcd: main.etcd, serviceName: main.serviceName });
        await stateMachine.init(main);
    });

    beforeEach(() => {
        stateMachine._initStateMachine();
    });
    it('should set inititial state to bootstrap', () => {
        expect(stateMachine.state).to.eql(workerStates.bootstrap);
    });
    it('should set inititial state to ready', () => {
        stateMachine.bootstrap();
        expect(stateMachine.state).to.eql(workerStates.ready);
    });
    it('should transition from ready to init', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        expect(stateMachine.state).to.eql(workerStates.init);
    });
    it('should transition from init to working', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        expect(stateMachine.state).to.eql(workerStates.working);
    });
    it('should transition from working to results', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        stateMachine.done();
        expect(stateMachine.state).to.eql(workerStates.results);
    });

    it('should transition from results to ready', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        stateMachine.done();
        stateMachine.cleanup();
        expect(stateMachine.state).to.eql(workerStates.ready);
    });

    it('should raise event on state enter', () => {
        stateMachine.bootstrap();
        const spy = sinon.spy();
        stateMachine.on(stateEvents.stateEntered, spy);
        stateMachine.prepare();
        expect(spy.callCount).to.eql(1);
        stateMachine.start();
        expect(spy.callCount).to.eql(2);
        stateMachine.done();
        expect(spy.callCount).to.eql(3);
        stateMachine.cleanup();
        expect(spy.callCount).to.eql(4);
        expect(stateMachine.state).to.eql(workerStates.ready);
    });
    it('could not pause if algorithm not running', async () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        stateMachine.done();
        etcd.workers.setState({ workerId: etcd.discovery._instanceId, status: { command: 'stopProcessing' } });
        await delay(600);
        expect(jobConsumer._consumerPaused).to.eql(false);
    });
    it('should fail to transition from ready to working', () => {
        expect(stateMachine.start).to.throw();
    });
});
