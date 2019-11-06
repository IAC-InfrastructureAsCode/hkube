const { expect } = require('chai');
const fse = require('fs-extra');
const uuidv4 = require('uuid/v4');
const HttpStatus = require('http-status-codes');
const { MESSAGES } = require('../lib/consts/builds');
const { algorithms } = require('./mocks');
const { request } = require('./utils');
let restUrl, restPath, applyPath;

const defaultProps = {
    minHotWorkers: 0,
    options: {
        debug: false,
        pending: false
    },
    type: "Image"
}

const gitRepo = 'https://github.com/kube-HPC/hkube';

describe('Store/Algorithms', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/store/algorithms`;
        applyPath = `${restPath}/apply`;
    });
    describe('/store/algorithms:name GET', () => {
        it('should throw error algorithm not found', async () => {
            const options = {
                uri: restPath + '/not_exists',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('algorithm not_exists Not Found');
        });
        it('should return specific algorithm', async () => {
            const body = {
                name: "test-alg",
                algorithmImage: "hkube/algorithm-example",
                cpu: 1,
                mem: "5000Ki"
            };
            const options = {
                uri: restPath,
                body
            };
            const r = await request(options);

            const getOptions = {
                uri: restPath + '/test-alg',
                method: 'GET'
            };
            const response = await request(getOptions);
            expect(response.body).to.deep.equal({
                ...body,
                ...defaultProps
            });
        });
    });
    describe('/store/algorithms:name DELETE', () => {
        it('should throw error algorithm not found', async () => {
            const options = {
                uri: restPath + '/not_exists',
                method: 'DELETE',
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('algorithm not_exists Not Found');
        });
        it('should delete specific algorithm', async () => {
            const optionsInsert = {
                uri: restPath,
                body: {
                    name: "delete",
                    algorithmImage: "image"
                }
            };
            await request(optionsInsert);

            const options = {
                uri: restPath + '/delete',
                method: 'DELETE',
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.equal('OK');
        });
    });
    describe('/store/algorithms GET', () => {
        it('should success to get list of algorithms', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.be.an('array');
        });
    });
    describe('/store/algorithms POST', () => {
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should throw validation error of data.name should be string', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: {}
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should be string');
        });
        it('should throw validation error of memory min 4 Mi', async () => {
            const body = {
                name: uuidv4(),
                algorithmImage: "image",
                mem: "3900Ki",
                cpu: 1
            }
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('memory must be at least 4 Mi');
        });
        it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: ''
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
        });
        it('should throw conflict error', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: "conflict",
                    algorithmImage: "image"
                }
            };
            await request(options);
            const response = await request(options);
            expect(response.response.statusCode).to.equal(409);
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.equal('algorithm conflict already exists');
        });
        const invalidChars = ['/', '_', '*', '#', '"', '%', 'A'];
        invalidChars.forEach((v) => {
            it(`should throw invalid algorithm name if include ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: `notvalid${v}name`,
                        algorithmImage: "image"
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('algorithm name must contain only lower-case alphanumeric, dash or dot');
            });
        });
        const invalidStartAndEndChars = ['/', '_', '*', '#', '"', '%', '-', 'A'];
        invalidStartAndEndChars.forEach((v) => {
            it(`should throw invalid if algorithm name if start with ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: `${v}notvalidname`,
                        algorithmImage: "image"
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('algorithm name must contain only lower-case alphanumeric, dash or dot');
            });
            it(`should throw invalid if algorithm name if end with ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: `notvalidname${v}`,
                        algorithmImage: "image"
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('algorithm name must contain only lower-case alphanumeric, dash or dot');
            });
        });
        it('should succeed to store algorithm name (www.example.com)', async () => {
            const body = {
                name: '2-www.exam-ple.com' + uuidv4(),
                algorithmImage: "image",
                mem: "50Mi",
                cpu: 1
            }
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.CREATED);
            expect(response.body).to.deep.equal({
                ...body,
                ...defaultProps
            });
        });
        it('should succeed to store and get multiple algorithms', async function () {
            this.timeout(5000);
            const limit = 350;
            const keys = Array.from(Array(limit).keys());
            const algorithms = keys.map(k => ({
                name: `stress-${k}-${uuidv4()}`,
                algorithmImage: "image",
                mem: "50Mi",
                cpu: k,
                ...defaultProps
            }));

            const result = await Promise.all(algorithms.map(a => request({ uri: restPath, body: a })));

            result.forEach((r, i) => {
                expect(r.body).to.deep.equal(algorithms[i]);
            });

            const options = {
                uri: `${restPath}?name=stress&limit=${limit}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.has.lengthOf(limit);
        });
        it('should succeed to store algorithm', async () => {
            const body = {
                name: uuidv4(),
                algorithmImage: "image",
                mem: "50Mi",
                cpu: 1,
                type: "Image"
            }
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.CREATED);
            expect(response.body).to.deep.equal({
                ...body,
                ...defaultProps
            });
        });
    });
    describe('/store/algorithms/apply POST', () => {
        describe('Validation', () => {
            it('should throw validation error of required property name', async () => {
                const options = {
                    uri: applyPath,
                    formData: {}
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal("data should have required property 'name'");
            });
            it('should throw validation error of data.name should be string', async () => {
                const payload = JSON.stringify({ name: {} });
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('data.name should be string');
            });
            it('should throw validation error of memory min 4 Mi', async () => {
                const body = {
                    name: uuidv4(),
                    algorithmImage: "image",
                    mem: "3900Ki",
                    cpu: 1
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('memory must be at least 4 Mi');
            });
            it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
                const payload = JSON.stringify({ name: '' });
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
            });
            it('should throw validation invalid env', async () => {
                const body = {
                    name: uuidv4(),
                    algorithmImage: "image",
                    mem: "3900Ki",
                    cpu: 1,
                    env: "no_such"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.contain('data.env should be equal to one of the allowed values');
            });
            it('should throw validation invalid fileExt', async () => {
                const payload = {
                    name: `my-alg-${uuidv4()}`,
                    mem: "50Mi",
                    cpu: 1,
                    version: '1.9.0'
                }
                const formData = {
                    payload: JSON.stringify(payload),
                    file: fse.createReadStream('tests/mocks/algorithm.tar')
                };
                const options = {
                    uri: restPath + '/apply',

                    formData
                };
                const response = await request(options);
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.contain('data.fileExt should be equal to one of the allowed values');
            });
            it('should throw error of missing image and file', async () => {
                const body = {
                    name: `my-alg-${uuidv4()}`,
                    mem: "50Mi",
                    cpu: 1
                };
                const formData = {
                    payload: JSON.stringify(body)
                };
                const options = {
                    uri: applyPath,
                    formData
                };

                const response = await request(options)
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal(MESSAGES.APPLY_ERROR);
            });
            it('should throw error of having image and file', async () => {
                const body = {
                    name: `my-alg-${uuidv4()}`,
                    algorithmImage: 'image',
                    mem: "50Mi",
                    cpu: 1,
                    env: 'python'
                };
                const formData = {
                    payload: JSON.stringify(body),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const options = {
                    uri: applyPath,
                    formData
                };

                const response = await request(options)
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal(MESSAGES.FILE_AND_IMAGE);
            });
            it('should not throw error when git repo was not supplied', async () => {
                const apply = {
                    name: `my-alg-${uuidv4()}`,
                    algorithmImage: 'test-algorithmImage',
                    type: "Git",
                    mem: "50Mi",
                    cpu: 1
                }
                const uri = restPath + '/apply';
                const req = { uri, formData: { payload: JSON.stringify(apply) } };
                const res = await request(req)
                expect(res.response.statusCode).to.equal(HttpStatus.OK);
                expect(res.body).to.not.have.property('buildId');
            });
            it('should not throw error when file was not supplied', async () => {
                const apply = {
                    name: `my-alg-${uuidv4()}`,
                    algorithmImage: 'test-algorithmImage',
                    type: "Code",
                    mem: "50Mi",
                    cpu: 1
                }
                const uri = restPath + '/apply';
                const req = { uri, formData: { payload: JSON.stringify(apply) } };
                const res = await request(req)
                expect(res.response.statusCode).to.equal(HttpStatus.OK);
                expect(res.body).to.not.have.property('buildId');
            });
        });
        xdescribe('Github', () => {
            it('should throw error of required property url', async () => {
                const name = uuidv4();
                const body = {
                    name,
                    gitRepository: {
                    },
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`data.gitRepository should have required property 'url'`);
            });
            it('should throw error of match format url', async () => {
                const name = uuidv4();
                const body = {
                    name,
                    gitRepository: {
                        url: ''
                    },
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`data.gitRepository.url should match format "url"`);
            });
            it('should throw error of url not found', async () => {
                const name = uuidv4();
                const body = {
                    name,
                    gitRepository: {
                        url: 'http://no_such_url'
                    },
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`invalid url 'http://no_such_url'`);
            });
            it('should throw error of branch not found', async () => {
                const name = uuidv4();
                const body = {
                    name,
                    gitRepository: {
                        url: 'http://no_such_url',
                        branchName: "no_such"
                    },
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`invalid url 'http://no_such_url'`);
            });
            it('should throw error of git repository is empty', async () => {
                const url = 'https://github.com/hkube/empty';
                const name = uuidv4();
                const body = {
                    name,
                    gitRepository: {
                        url,
                    },
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`Git Repository is empty. (${url})`);
            });
            it('should create build with last commit data', async () => {
                const url = 'https://github.com/hkube.gits/my.git.foo.bar.git';
                const name = uuidv4();
                const body = {
                    name,
                    gitRepository: {
                        url,
                    },
                    env: 'nodejs',
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body).to.have.property('buildId');
            });
            it('should create build with last commit data', async () => {
                const name = uuidv4();
                const body = {
                    name,
                    mem: "6000Mi",
                    cpu: 1,
                    gitRepository: {
                        url: gitRepo
                    },
                    env: "nodejs"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body).to.have.property('buildId');
            });
            it('should not trigger new build if same commit id', async () => {
                const body = {
                    name: uuidv4(),
                    gitRepository: {
                        url: gitRepo
                    },
                    env: "nodejs",
                    type: "Git"
                }
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const res1 = await request(options);
                expect(res1.body).to.have.property('buildId');

                const res2 = await request(options);
                expect(res2.body).to.not.have.property('buildId');
            });
        });
        describe('Code', () => {
            it('should succeed to apply algorithm with first build', async () => {
                const payload = {
                    name: `my-alg-${uuidv4()}`,
                    mem: "50Mi",
                    cpu: 1,
                    version: '1.9.0',
                    env: 'nodejs'
                }
                const formData = {
                    payload: JSON.stringify(payload),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const options = {
                    uri: restPath + '/apply',
                    formData
                };
                const response = await request(options);
                expect(response.response.statusCode).to.equal(HttpStatus.OK);
                expect(response.body).to.have.property('buildId');
                expect(response.body).to.have.property('messages');
                expect(response.body.messages[0]).to.equal(MESSAGES.FIRST_BUILD);

                const getOptions = {
                    uri: restPath + '/' + payload.name,
                    method: 'GET'
                };
                const algResponse = await request(getOptions);
                expect(algResponse.body.fileInfo).to.have.property('fileExt');
                expect(algResponse.body.fileInfo).to.have.property('checksum');
                expect(algResponse.body.fileInfo).to.have.property('fileSize');
            });
            it('should succeed to apply algorithm without buildId in response', async () => {
                const body = {
                    name: `my-alg-${uuidv4()}`,
                    mem: "50Mi",
                    cpu: 1
                }
                const body1 = {
                    ...body,
                    version: '1.8.0',
                    env: 'nodejs',
                    type: 'Code'
                }
                const body2 = {
                    ...body,
                    version: '1.8.0',
                    env: 'nodejs',
                    cpu: 2
                }
                const options = {
                    uri: restPath,
                    body: body1
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const uri = restPath + '/apply';
                const options1 = {
                    uri,
                    formData: formData1
                };
                const options2 = {
                    uri,
                    formData: formData2
                };
                // insert algorithm
                await request(options);

                // apply algorithm
                await request(options1)

                // apply algorithm again
                const response = await request(options2);
                expect(response.response.statusCode).to.equal(HttpStatus.OK);
                expect(response.body).to.not.have.property('buildId');
                expect(response.body.messages[0]).to.equal(MESSAGES.NO_TRIGGER_FOR_BUILD);
            });
            it('should succeed to apply algorithm with buildId due to change in env', async () => {
                const body = {
                    name: `my-alg-${uuidv4()}`,
                    mem: "50Mi",
                    cpu: 1
                }
                const body1 = {
                    ...body,
                    version: '1.8.0',
                    env: 'nodejs',
                    type: 'Code'
                }
                const body2 = {
                    ...body,
                    version: '1.9.0',
                    env: 'python'
                }
                const options = {
                    uri: restPath,
                    body: body1
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const uri = restPath + '/apply';
                const options1 = {
                    uri,
                    formData: formData1
                };
                const options2 = {
                    uri,
                    formData: formData2
                };
                // insert algorithm
                await request(options);

                // apply algorithm
                await request(options1)

                // apply algorithm again
                const response = await request(options2);
                expect(response.response.statusCode).to.equal(HttpStatus.OK);
                expect(response.body).to.have.property('buildId');
                expect(response.body.messages[0]).to.contains('a build was triggered due to change in env');
            });
            it('should succeed to apply algorithm without buildId in response', async () => {
                const body = {
                    name: `my-alg-${uuidv4()}`,
                    mem: "50Mi",
                    cpu: 1,
                    version: '1.8.0',
                    env: 'nodejs',
                    type: 'Code'
                }
                const body1 = {
                    ...body,
                    cpu: 1
                }
                const body2 = {
                    ...body,
                    cpu: 2
                }
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2)
                };
                const uri = restPath + '/apply';
                const options1 = {
                    uri,
                    formData: formData1
                };
                const options2 = {
                    uri,
                    formData: formData2
                };

                // apply algorithm
                await request(options1)

                // apply algorithm again
                const response = await request(options2);
                expect(response.response.statusCode).to.equal(HttpStatus.OK);
                expect(response.body).to.not.have.property('buildId');
            });
        })
        describe('Image', () => {
            it('should succeed to apply algorithm with just algorithmImage change', async () => {
                const apply1 = {
                    name: `my-alg-${uuidv4()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    algorithmImage: 'new-test-algorithmImage'
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...apply1, ...apply2 });
            });
            it('should succeed to apply algorithm with just cpu change', async () => {
                const apply1 = {
                    name: `my-alg-${uuidv4()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    cpu: 2
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...apply1, ...apply2 });
            });
            it('should succeed to apply algorithm with just gpu change', async () => {
                const apply1 = {
                    name: `my-alg-${uuidv4()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    gpu: 2
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...apply1, ...apply2 });
            });
            it('should succeed to apply algorithm with just mem change', async () => {
                const apply1 = {
                    name: `my-alg-${uuidv4()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    mem: "1.5Gi"
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...apply1, ...apply2 });
            });
            it('should succeed to apply algorithm with just minHotWorkers change', async () => {
                const apply1 = {
                    name: `my-alg-${uuidv4()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    minHotWorkers: 3
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...apply1, ...apply2 });
            });
            it('should succeed to apply algorithm with just algorithmEnv change', async () => {
                const apply1 = {
                    name: `my-alg-${uuidv4()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    },
                    algorithmEnv: {
                        storage: 's3'
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    algorithmEnv: {
                        storage: 'fs'
                    }
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...apply1, ...apply2 });
            });
        });
    });
    describe('/store/algorithms PUT', () => {
        it('should throw validation error of memory min 4 Mi', async () => {
            const body = Object.assign({}, algorithms[0]);
            body.mem = '3900Ki';
            const options = {
                method: 'PUT',
                uri: restPath,
                body
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('memory must be at least 4 Mi');
        });
        it('should succeed to update algorithm', async () => {
            const body = { ...algorithms[0] };
            const options = {
                uri: restPath,
                method: 'PUT',
                body
            };
            const response = await request(options);
            expect(response.body).to.deep.equal(body);
        });
    });
});
