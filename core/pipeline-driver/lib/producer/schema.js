module.exports = {
    "name": "options",
    "type": "object",
    "properties": {
        "setting": {
            "type": "object",
            "properties": {
                "prefix": {
                    "type": "string",
                    "default": "algorithm-queue",
                    "description": "prefix for all queue keys"
                }
            },
            "default": {}
        }
    }
}