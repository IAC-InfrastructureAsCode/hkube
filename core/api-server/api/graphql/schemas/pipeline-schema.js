const { gql } = require('apollo-server');

const pipelineTypeDefs = gql`
type Cron { enabled: Boolean pattern: String }

type Triggers { cron: Cron }

type ConcurrentPipelines { amount: Int rejectOnFailure: Boolean }

type Options { batchTolerance: Int
  ttl: Int
  progressVerbosityLevel: String
  concurrentPipelines: ConcurrentPipelines }

type Metrics { tensorboard: Boolean }

type Retry { policy: String limit: Int }

type PipelineNodes { 
  nodeName: String
  algorithmName: String
  ttl: Int
  includeInResult: Boolean
  batchOperation: String
  metrics: Metrics
  retry: Retry
 # input: [String ]
 }

type FlowInput { mul: Int data: Int }

type Pipeline { modified: Float
  kind: String
  name: String
  priority: Int
  experimentName: String
  triggers: Triggers
  options: Options
  nodes: [PipelineNodes ]
  flowInput: FlowInput }

type AutogeneratedPipelines { list: [Pipeline ],pipelinesCount:Int }

extend type Query {
    pipelines:AutogeneratedPipelines
}

`;

module.exports = pipelineTypeDefs;
