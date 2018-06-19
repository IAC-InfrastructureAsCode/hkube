const sumBy = require('lodash.sumby');
const parse = require('@hkube/units-converter');
const objectPath = require('object-path');

/**
 * normalizes the worker info from discovery
 * input will look like:
 * <code>
 * {
 *  '/discovery/workers/worker-uuid':{
 *      algorithmName,
 *      workerStatus,
 *      jobStatus,
 *      error
 *      },
 *  '/discovery/workers/worker-uuid2':{
 *      algorithmName,
 *      workerStatus,
 *      jobStatus,
 *      error
 *      }
 * }
 * </code>
 * normalized output should be:
 * <code>
 * {
 *   worker-uuid:{
 *     algorithmName,
 *     workerStatus // ready, working
 * 
 *   }
 * }
 * </code>
 * @param {*} workers 
 */

const normalizeWorkers = (workers) => {
    if (workers == null) {
        return [];
    }
    const workersArray = Object.entries(workers).map(([k, v]) => {
        const workerId = k.match(/([^/]*)\/*$/)[0];
        return {
            id: workerId,
            algorithmName: v.algorithmName,
            workerStatus: v.workerStatus,
            workerPaused: !!v.workerPaused,
            podName: v.podName
        };
    });
    return workersArray;
};

const normalizeResources = ({ pods, nodes } = {}) => {
    if (!pods || !nodes) {
        return {
            allNodes: {
                ratio: {
                    cpu: 0,
                    memory: 0
                },
                free: {
                    cpu: 0,
                    memory: 0
                }
            }
        };
    }
    const initial = nodes.body.items.reduce((acc, cur) => {
        acc[cur.metadata.name] = {
            requests: { cpu: 0, memory: 0 },
            limits: { cpu: 0, memory: 0 },
            total: {
                cpu: parse.getCpuInCore(cur.status.allocatable.cpu),
                memory: parse.getMemoryInMi(cur.status.allocatable.memory)
            }
        };
        return acc;
    }, {});
    initial.allNodes = {
        requests: { cpu: 0, memory: 0 },
        limits: { cpu: 0, memory: 0 },
        total: {
            cpu: sumBy(Object.values(initial), 'total.cpu'),
            memory: sumBy(Object.values(initial), 'total.memory'),
        }
    };
    const resourcesPerNode = pods.body.items.filter(p => p.status.phase === 'Running').reduce((accumulator, pod) => {
        const { nodeName } = pod.spec;
        if (!nodeName) {
            return accumulator;
        }
        const requestCpu = sumBy(pod.spec.containers, c => parse.getCpuInCore(objectPath.get(c, 'resources.requests.cpu', '0m')));
        const requestMem = sumBy(pod.spec.containers, c => parse.getMemoryInMi(objectPath.get(c, 'resources.requests.memory', 0)));
        const limitsCpu = sumBy(pod.spec.containers, c => parse.getCpuInCore(objectPath.get(c, 'resources.limits.cpu', '0m')));
        const limitsMem = sumBy(pod.spec.containers, c => parse.getMemoryInMi(objectPath.get(c, 'resources.limits.memory', 0)));

        accumulator[nodeName].requests.cpu += requestCpu;
        accumulator[nodeName].requests.memory += requestMem;
        accumulator.allNodes.requests.cpu += requestCpu;
        accumulator.allNodes.requests.memory += requestMem;

        accumulator[nodeName].limits.cpu += limitsCpu;
        accumulator[nodeName].limits.memory += limitsMem;
        accumulator.allNodes.limits.cpu += limitsCpu;
        accumulator.allNodes.limits.memory += limitsMem;
        return accumulator;
    }, initial);
    Object.keys(resourcesPerNode).forEach((k) => {
        resourcesPerNode[k].ratio = {
            cpu: resourcesPerNode[k].requests.cpu / resourcesPerNode[k].total.cpu,
            memory: resourcesPerNode[k].requests.memory / resourcesPerNode[k].total.memory,
        };
        resourcesPerNode[k].free = {
            cpu: resourcesPerNode[k].total.cpu - resourcesPerNode[k].requests.cpu,
            memory: resourcesPerNode[k].total.memory - resourcesPerNode[k].requests.memory,
        };
    });

    return resourcesPerNode;
};

const normalizeRequests = (requests) => {
    if (requests == null) {
        return [];
    }
    return requests.map(r => ({ algorithmName: r.name, pods: r.data.pods }));
};

const normalizeJobs = (jobsRaw, predicate = () => true) => {
    if (!jobsRaw || !jobsRaw.body || !jobsRaw.body.items) {
        return [];
    }
    const jobs = jobsRaw.body.items
        .filter(predicate)
        .map(j => ({
            name: j.metadata.name,
            algorithmName: j.metadata.labels['algorithm-name'],
            active: j.status.active === 1
        }));
    return jobs;
};

const mergeWorkers = (workers, jobs) => {
    const foundJobs = [];
    const mergedWorkers = workers.map((w) => {
        const jobForWorker = jobs.find(j => w.podName && w.podName.startsWith(j.name));
        if (jobForWorker) {
            foundJobs.push(jobForWorker.name);
        }
        return { ...w, job: jobForWorker ? { ...jobForWorker } : undefined };
    });

    const extraJobs = jobs.filter((job) => {
        return !foundJobs.find(j => j === job.name);
    });
    return { mergedWorkers, extraJobs };
};

module.exports = {
    normalizeWorkers,
    normalizeRequests,
    normalizeJobs,
    mergeWorkers,
    normalizeResources
};
