module.exports = [
  {
    name: "gt-alg",
    algorithmImage: "hkube/algorithm-gateway",
    cpu: 1.5,
    jobId: "job-1",
    mem: "50Mi",
    type: "Image",
    minHotWorkers: 0,
    kind: "gateway",
    created: Date.now(),
    modified: Date.now(),
    options: {
      debug: false,
      pending: false,
    },
  },
  {
    name: "gt-alg2",
    algorithmImage: "hkube/algorithm-gateway",
    jobId: "job-1",
    mem: "50Mi",
    type: "Image",
    minHotWorkers: 0,
    kind: "gateway",
    created: Date.now() - 300000,
    modified: Date.now() - 300000,
    options: {
      debug: false,
      pending: false,
    },
  },
  {
    name: "gt-alg3",
    algorithmImage: "hkube/algorithm-gateway",
    cpu: 1.5,
    jobId: "job-notExist",
    mem: "50Mi",
    type: "Image",
    minHotWorkers: 0,
    kind: "gateway",
    created: Date.now(),
    modified: Date.now(),
    options: {
      debug: false,
      pending: false,
    },
  },
  {
    name: "gt-alg4",
    algorithmImage: "hkube/algorithm-gateway",
    cpu: 1.5,
    jobId: "job-notExist",
    mem: "50Mi",
    type: "Image",
    minHotWorkers: 0,
    kind: "gateway",
    created: Date.now() - 300000,
    modified: Date.now() - 300000,
    options: {
      debug: false,
      pending: false,
    },
  }
];