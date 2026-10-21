import Response from '../src/stream/response';
import stream from 'stream';

describe('StreamResponse (stream/response.js)', () => {
    test('writes string and buffer chunks, default base64 encoding', () => {
        let resolvedData = null;
        const res = new Response((data) => { resolvedData = data; }, 'generic', null);

        res.write('hello ');
        res.write(Buffer.from('world'));
        res.end();

        expect(resolvedData).toBeDefined();
        expect(resolvedData.body).toBe(Buffer.from('hello world').toString('base64'));
        expect(resolvedData.isBase64Encoded).toBe(true);
    });

    test('writes string and buffer chunks when encoded as utf8', () => {
        let resolvedData = null;
        const res = new Response((data) => { resolvedData = data; }, 'generic', null);
        res.encode('utf8');

        res.write('hello ');
        res.write(Buffer.from('world'));
        res.end();

        expect(resolvedData).toBeDefined();
        expect(resolvedData.body).toBe('hello world');
        expect(resolvedData.isBase64Encoded).toBe(false);
    });

    test('throws TypeError on invalid write argument', () => {
        const res = new Response(jest.fn(), 'generic', null);
        expect(() => res.write(123)).toThrow(TypeError);
        expect(() => res.write(null)).toThrow(TypeError);
    });

    test('handles end with chunk and resolves with base64 encoding', () => {
        let resolvedData = null;
        const res = new Response((data) => { resolvedData = data; }, 'generic', null);

        expect(res.isBase64Encoded()).toBe(true);
        res.encode('base64');
        expect(res.isBase64Encoded()).toBe(true);

        res.end('base64 content');

        expect(resolvedData.body).toBe(Buffer.from('base64 content').toString('base64'));
        expect(resolvedData.isBase64Encoded).toBe(true);
        expect(resolvedData.statusCode).toBe(200);
    });

    test('handles encode with non-base64 or falsey encoding', () => {
        const res = new Response(jest.fn(), 'generic', null);
        res.encode('utf8');
        expect(res.isBase64Encoded()).toBe(false);

        res.encode(null);
        expect(res.isBase64Encoded()).toBeFalsy();
    });

    test('isPlatform checks matching string or array', () => {
        const res = new Response(jest.fn(), 'aws', 'http');
        expect(res.isPlatform('aws')).toBe(true);
        expect(res.isPlatform(['gcp', 'aws'])).toBe(true);
        expect(res.isPlatform('azure')).toBe(false);
        expect(res.isPlatform(null)).toBeFalsy();
    });

    test('formats response for azure platform with custom status code', () => {
        let resolvedData = null;
        const res = new Response((data) => { resolvedData = data; }, 'azure', null);
        res.encode('utf8');
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end('{"created":true}');

        expect(resolvedData).toEqual({
            status: 201,
            headers: {
                'content-type': 'application/json',
                'content-length': 16
            },
            body: '{"created":true}'
        });
    });

    test('formats response for gcp platform', () => {
        let resolvedData = null;
        const res = new Response((data) => { resolvedData = data; }, 'gcp', null);
        res.encode('utf8');
        res.statusCode = 204;
        res.end();

        expect(resolvedData).toEqual({
            statusCode: 204,
            headers: {
                'content-length': 0
            },
            body: ''
        });
    });

    test('formats response for aws platform with set-cookie header extraction', () => {
        let resolvedData = null;
        const res = new Response((data) => { resolvedData = data; }, 'aws', 'http');
        res.encode('utf8');
        res.setHeader('Set-Cookie', ['session=abc', 'theme=dark']);
        res.end('aws response');

        expect(resolvedData.statusCode).toBe(200);
        expect(resolvedData.cookies).toEqual(['session=abc', 'theme=dark']);
        expect(resolvedData.headers['set-cookie']).toBeUndefined();
        expect(resolvedData.body).toBe('aws response');
        expect(resolvedData.isBase64Encoded).toBe(false);
    });

    test('formats response for aws platform without set-cookie header', () => {
        let resolvedData = null;
        const res = new Response((data) => { resolvedData = data; }, 'aws', 'http');
        res.encode('utf8');
        res.setHeader('X-Custom', 'value');
        res.end('no cookie');

        expect(resolvedData.cookies).toBeUndefined();
        expect(resolvedData.headers['x-custom']).toBe('value');
    });

    test('exercises underlying dummyWritable write method', () => {
        let capturedOptions = null;
        jest.isolateModules(() => {
            const origWritable = stream.Writable;
            stream.Writable = function(opts) {
                capturedOptions = opts;
                return new origWritable(opts);
            };
            Object.setPrototypeOf(stream.Writable, origWritable);
            stream.Writable.prototype = origWritable.prototype;

            const _ResponseModule = require('../src/stream/response');
            const ResponseModule = _ResponseModule.default || _ResponseModule;
            new ResponseModule(jest.fn(), 'generic', null);
            stream.Writable = origWritable;
        });

        expect(capturedOptions).toBeDefined();
        let cbCalled = false;
        capturedOptions.write('chunk', 'utf8', () => { cbCalled = true; });
        expect(cbCalled).toBe(true);
    });
    test('uses fallback 200 when statusCode is null or undefined', () => {
        const res = new Response(jest.fn(), 'generic', null);
        res.statusCode = null;
        const result = res.toJSON();
        expect(result.statusCode).toBe(200);
    });
});
