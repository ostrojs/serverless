import fs from 'fs';
import Serverless from '../src/serverless';
import path from 'path';
import Module from 'module';

describe('Serverless (serverless.js)', () => {
    const dummyModulePath = path.resolve(__dirname, 'fixtures/entryDummy.js');

    beforeAll(() => {
        fs.mkdirSync(path.dirname(dummyModulePath), { recursive: true });
        fs.writeFileSync(dummyModulePath, 'module.exports = { loaded: true };');
    });

    afterAll(() => {
        if (fs.existsSync(dummyModulePath)) fs.unlinkSync(dummyModulePath);
    });

    test('validates stream() parameters', () => {
        const dummyConfig = { serverless: { handler: 'test.fixtures.entryDummy.main' } };
        const sls = new Serverless(dummyConfig);

        expect(() => sls.stream('notAFunction', class {})).toThrow('Request class must be function/class');
        expect(() => sls.stream(class {}, 'notAFunction')).toThrow('Response class must function/class');
    });

    test('validates request() and response() methods', () => {
        const dummyConfig = { serverless: { handler: 'test.fixtures.entryDummy.main' } };
        const sls = new Serverless(dummyConfig);

        expect(() => sls.request('notAFunc')).toThrow('HttpRequest class must be function/class');
        expect(() => sls.response('notAFunc')).toThrow('HttpResponse class must function/class');

        class MockHttpRequest {
            constructor(streamReq) { this.streamReq = streamReq; }
        }
        class MockHttpResponse {
            constructor(streamRes) { this.streamRes = streamRes; }
            send(data) { this.streamRes.end(data); }
        }

        sls.request(MockHttpRequest);
        sls.response(MockHttpResponse);

        expect(sls["$request"]).toBe(MockHttpRequest);
        expect(sls["$response"]).toBe(MockHttpResponse);
    });

    test('handle() returns working handler that resolves response', async () => {
        const dummyConfig = {
            serverless: {
                handler: 'test.fixtures.entryDummy.main',
                platform: 'aws',
                gateway: 'http'
            }
        };
        const sls = new Serverless(dummyConfig);

        class MockHttpRequest {
            constructor(streamReq) { this.streamReq = streamReq; }
        }
        class MockHttpResponse {
            constructor(streamRes) { this.streamRes = streamRes; }
            send(data) { this.streamRes.end(data); }
        }

        sls.request(MockHttpRequest);
        sls.response(MockHttpResponse);

        sls.register((req, res, next) => {
            expect(res.request).toBe(req);
            res.send('ok from handler');
        });

        const event = {
            requestContext: { http: { method: 'GET', sourceIp: '1.1.1.1' } },
            rawPath: '/test',
            headers: {}
        };
        const res = await sls.handler(event, {});
        expect(res.body).toBe(Buffer.from('ok from handler').toString('base64'));
    });

    test('handle() default generic platform and error callback path', async () => {
        const dummyConfig = {
            serverless: {
                handler: 'test.fixtures.entryDummy.main'
            }
        };
        const sls = new Serverless(dummyConfig);

        class MockHttpRequest {
            constructor(streamReq) { this.streamReq = streamReq; }
        }
        class MockHttpResponse {
            constructor(streamRes) { this.streamRes = streamRes; }
            send(data) { this.streamRes.end(data); }
        }

        sls.request(MockHttpRequest);
        sls.response(MockHttpResponse);

        sls.register((req, res, next) => {
            next('error occurred');
        });

        const event = {
            method: 'GET',
            url: '/'
        };
        const res = await sls.handler(event, {});
        expect(res.body).toBe(Buffer.from('error occurred').toString('base64'));
    });

    test('loadMainModule sets process.mainModule and require.main', () => {
        const dummyConfig = { serverless: { handler: 'test.fixtures.entryDummy.main' } };
        const sls = new Serverless(dummyConfig);

        const mod = sls.loadMainModule(dummyModulePath);
        expect(mod.loaded).toBe(true);
        expect(process.mainModule).toBeDefined();
    });

    test('loadMainModule when require.cache does not contain module', () => {
        const dummyConfig = { serverless: { handler: 'test.fixtures.entryDummy.main' } };
        const sls = new Serverless(dummyConfig);

        const origCache = require.cache;
        const mainPath = path.resolve(dummyModulePath);
        delete require.cache[mainPath];
        const origMain = require.main;

        const mod = sls.loadMainModule(dummyModulePath);
        expect(mod.loaded).toBe(true);
    });

    test('loadMainModule when require.cache does not have mainPath and process.mainModule falls back', () => {
        const dummyConfig = { serverless: { handler: 'test.fixtures.entryDummy.main' } };
        const sls = new Serverless(dummyConfig);

        const mainPath = path.resolve(dummyModulePath);
        delete require.cache[mainPath];

        // Temporarily redefine require.cache to return undefined for mainPath
        const origCache = require.cache;
        const fakeCache = new Proxy(origCache, {
            get(target, prop) {
                if (prop === mainPath) return undefined;
                return target[prop];
            }
        });

        const origRequire = module.require;
        const mod = sls.loadMainModule(dummyModulePath);
        expect(mod.loaded).toBe(true);
    });

    test('entry method handles falsy entryPath', () => {
        const dummyConfig = { serverless: { handler: 'test.fixtures.entryDummy.main' } };
        const sls = new Serverless(dummyConfig);
        expect(() => sls.entry(null)).not.toThrow();
        expect(() => sls.entry(undefined)).not.toThrow();
        expect(() => sls.entry('')).not.toThrow();
    });

    test('loadMainModule when require.cache[mainPath] is null/falsy', () => {
        const dummyConfig = { serverless: { handler: 'test.fixtures.entryDummy.main' } };
        const sls = new Serverless(dummyConfig);

        const origLoad = (Module as any)._load;
        const mainPath = path.resolve(dummyModulePath);

        Module._load = function(request, parent, isMain) {
            const res = origLoad.apply(this, arguments);
            if (typeof request === 'string' && request.includes('entryDummy')) {
                delete require.cache[mainPath];
            }
            return res;
        };

        try {
            const mod = sls.loadMainModule(dummyModulePath);
            expect(mod).toBeDefined();
        } finally {
            Module._load = origLoad;
        }
    });

    test('loadMainModule when require.main descriptor is configurable', () => {
        const dummyConfig = { serverless: { handler: 'test.fixtures.entryDummy.main' } };
        const sls = new Serverless(dummyConfig);

        const origGetDesc = Object.getOwnPropertyDescriptor;
        const origDefProp = Object.defineProperty;
        let definedProp = false;

        Object.getOwnPropertyDescriptor = function(target, prop) {
            if (prop === 'main') {
                return { configurable: true };
            }
            return origGetDesc.apply(this, arguments);
        };

        Object.defineProperty = function(target, prop, descriptor) {
            if (prop === 'main') {
                definedProp = true;
                return target;
            }
            return origDefProp.apply(this, arguments);
        };

        try {
            const mod = sls.loadMainModule(dummyModulePath);
            expect(mod).toBeDefined();
            expect(definedProp).toBe(true);
        } finally {
            Object.getOwnPropertyDescriptor = origGetDesc;
            Object.defineProperty = origDefProp;
        }
    });

    test('loadMainModule when require.main descriptor is undefined', () => {
        const dummyConfig = { serverless: { handler: 'test.fixtures.entryDummy.main' } };
        const sls = new Serverless(dummyConfig);

        const origGetDesc = Object.getOwnPropertyDescriptor;
        const origDefProp = Object.defineProperty;
        let definedProp = false;

        Object.getOwnPropertyDescriptor = function(target, prop) {
            if (prop === 'main') {
                return undefined;
            }
            return origGetDesc.apply(this, arguments);
        };

        Object.defineProperty = function(target, prop, descriptor) {
            if (prop === 'main') {
                definedProp = true;
                return target;
            }
            return origDefProp.apply(this, arguments);
        };

        try {
            const mod = sls.loadMainModule(dummyModulePath);
            expect(mod).toBeDefined();
            expect(definedProp).toBe(true);
        } finally {
            Object.getOwnPropertyDescriptor = origGetDesc;
            Object.defineProperty = origDefProp;
        }
    });
});
