

## Documentation

```json
{
    "name": "pipeline_in_pipeline",
    "nodes": [
        {
            "nodeName": "A",
            "pipelineName": "simple",
            "input": ["@flowInput.data"]
        },
        {
            "nodeName": "B",
            "pipelineName": "simple",
            "input": ["@A"]
        }
    ],
    "flowInput": {
        "data": {
           "arr": [1,2,3,4,5]
        }
    },
    "options": {
        "batchTolerance": 100,
        "progressVerbosityLevel": "debug",
        "ttl": 3600
    },
    "webhooks": {
        "progress": "http://localhost:3003/webhook/progress",
        "result": "http://localhost:3003/webhook/result"
    },
    "priority": 3
}
```

The new pipeline

```json
{
    "name": "pipeline_in_pipeline",
    "nodes": [
        {
            "nodeName": "A.green",
            "algorithmName": "green-alg",
            "input": [
                "@flowInput.files.link"
            ]
        },
        {
            "nodeName": "A.yellow",
            "algorithmName": "yellow-alg",
            "input": [
                "@A.green"
            ]
        },
        {
            "nodeName": "A.black",
            "algorithmName": "black-alg",
            "input": [
                "@A.yellow"
            ]
        },
        {
            "nodeName": "B.green",
            "algorithmName": "green-alg",
            "input": [
                "@flowInput.files.link"
            ]
        },
        {
            "nodeName": "B.yellow",
            "algorithmName": "yellow-alg",
            "input": [
                "@B.green"
            ]
        },
        {
            "nodeName": "B.black",
            "algorithmName": "black-alg",
            "input": [
                "@B.yellow"
            ]
        }
    ],
    "flowInput": {
        "data": {
           "arr": [1,2,3,4,5]
        }
    },
    "options": {
        "batchTolerance": 100,
        "progressVerbosityLevel": "debug",
        "ttl": 3600
    },
    "webhooks": {
        "progress": "http://localhost:3003/webhook/progress",
        "result": "http://localhost:3003/webhook/result"
    },
    "priority": 3
}
```



