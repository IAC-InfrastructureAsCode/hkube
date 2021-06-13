module.exports = [
  {
    name: "debug-1",
    algorithmImage: "hkube/algorithm-debug",
    cpu: 1.5,
    jobId: "job-1",
    mem: "50Mi",
    type: "Image",
    minHotWorkers: 0,
    kind: "debug",
    created: Date.now(),
    options: {
      debug: false,
      pending: false,
    },
  },
  {
    name: "debug-2",
    algorithmImage: "hkube/algorithm-debug",
    jobId: "job-1",
    mem: "50Mi",
    type: "Image",
    minHotWorkers: 0,
    kind: "debug",
    created: Date.now() - 300000,
    options: {
      debug: false,
      pending: false,
    },
  },
  {
    name: "debug-3",
    algorithmImage: "hkube/algorithm-debug",
    cpu: 1.5,
    jobId: "job-notExist",
    mem: "50Mi",
    type: "Image",
    minHotWorkers: 0,
    kind: "debug",
    created: Date.now(),
    options: {
      debug: false,
      pending: false,
    },
  },
  {
    name: "debug-4",
    algorithmImage: "hkube/algorithm-debug",
    cpu: 1.5,
    jobId: "job-notExist",
    mem: "50Mi",
    type: "Image",
    minHotWorkers: 0,
    kind: "debug",
    created: Date.now() - 300000,
    options: {
      debug: false,
      pending: false,
    },
  }
];