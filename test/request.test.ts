import { describe, test, expect } from '@jest/globals';
import Request from '../src/stream/request';

describe('StreamRequest (stream/request.js)', () => {
    describe('MockSocket', () => {
        test('initializes with default options and handles methods', (done) => {
            const req = new Request({});
            const socket = req.socket;
            expect(socket.remoteAddress).toBe('127.0.0.1');

            const MockSocket = socket.constructor;
            const sockWithoutOpts = new MockSocket();
            expect(sockWithoutOpts.remoteAddress).toBe('');
            expect(sockWithoutOpts.encrypted).toBe(false);
            socket.setRemoteAddress('192.168.1.1');
            expect(socket.remoteAddress).toBe('192.168.1.1');
            expect(socket.encrypted).toBe(false);

            socket._read();
            socket._write(Buffer.from('chunk'), 'utf8', () => {
                done();
            });
        });
    });

    describe('Default platform', () => {
        test('handles empty event', () => {
            const req = new Request({});
            expect(req.method).toBe('GET');
            expect(req.url).toBe('/');
            expect(req.headers).toEqual({});
            expect(req.query).toEqual({});
            expect(req.params).toEqual({});
            expect(req.httpVersion).toBe('1.1');
            expect(req.body.length).toBe(0);
        });

        test('handles custom method, url, headers, query, params, cookies array', () => {
            const event = {
                method: 'POST',
                url: '/api/test',
                headers: {
                    'content-type': 'application/json',
                    'x-forwarded-for': '10.0.0.1, 10.0.0.2',
                    'x-forwarded-proto': 'https'
                },
                rawQueryString: { page: '1' },
                params: { id: '42' },
                body: JSON.stringify({ name: 'ostro' }),
                isBase64Encoded: false
            };
            const req = new Request(event);
            expect(req.method).toBe('POST');
            expect(req.url).toBe('/api/test');
            expect(req.query).toEqual({ page: '1' });
            expect(req.params).toEqual({ id: '42' });
            expect(req.socket.remoteAddress).toBe('10.0.0.1');
            expect(req.socket.encrypted).toBe(true);
            expect(req.body.toString()).toBe(JSON.stringify({ name: 'ostro' }));
        });

        test('handles base64 body', () => {
            const event = {
                body: Buffer.from('hello base64').toString('base64'),
                isBase64Encoded: true
            };
            const req = new Request(event);
            expect(req.body.toString()).toBe('hello base64');
        });

        test('joins cookies array into cookie header when missing', () => {
            const event = {
                headers: { cookie: 'a=1; b=2' }
            };
            const req = new Request(event);
            expect(req.headers.cookie).toBe('a=1; b=2');
        });
    });

    describe('AWS platform', () => {
        describe('http subtype', () => {
            test('normalizes http gateway v2 event with rawQueryString and sourceIp', () => {
                const event = {
                    requestContext: {
                        http: {
                            method: 'GET',
                            sourceIp: '1.2.3.4'
                        }
                    },
                    rawPath: '/items',
                    rawQueryString: 'sort=desc&limit=10',
                    headers: {
                        'x-forwarded-proto': 'https'
                    },
                    pathParameters: { cat: 'books' },
                    cookies: ['user=john', 'auth=true']
                };
                const req = new Request(event, {}, 'aws', 'http');
                expect(req.method).toBe('GET');
                expect(req.url).toBe('/items?sort=desc&limit=10');
                expect(req.query).toEqual({ sort: 'desc', limit: '10' });
                expect(req.params).toEqual({ cat: 'books' });
                expect(req.socket.remoteAddress).toBe('1.2.3.4');
                expect(req.socket.encrypted).toBe(true);
                expect(req.headers.cookie).toBe('user=john; auth=true');
            });

            test('normalizes http gateway v2 event with minimal fields', () => {
                const event = {
                    requestContext: { http: { method: 'DELETE' } },
                    rawPath: '/delete',
                    headers: { 'x-forwarded-for': '5.6.7.8' }
                };
                const req = new Request(event, {}, 'aws', 'http');
                expect(req.method).toBe('DELETE');
                expect(req.url).toBe('/delete');
                expect(req.query).toEqual({});
                expect(req.socket.remoteAddress).toBe('5.6.7.8');
            });

            test('falls back to empty string when remoteAddress is not present', () => {
                const event = {
                    requestContext: { http: { method: 'GET' } },
                    rawPath: '/'
                };
                const req = new Request(event, {}, 'aws', 'http');
                expect(req.socket.remoteAddress).toBe('');
            });
        });

        describe('lambda-url subtype', () => {
            test('normalizes lambda-url event with rawQueryString and sourceIp', () => {
                const event = {
                    requestContext: {
                        http: {
                            method: 'PUT',
                            sourceIp: '9.8.7.6'
                        }
                    },
                    rawPath: '/upload',
                    rawQueryString: 'type=img',
                    headers: { 'x-forwarded-proto': 'https' },
                    pathParameters: { fileId: '10' },
                    cookies: ['sid=xyz']
                };
                const req = new Request(event, {}, 'aws', 'lambda-url');
                expect(req.method).toBe('PUT');
                expect(req.url).toBe('/upload?type=img');
                expect(req.query).toEqual({ type: 'img' });
                expect(req.params).toEqual({ fileId: '10' });
                expect(req.socket.remoteAddress).toBe('9.8.7.6');
                expect(req.socket.encrypted).toBe(true);
                expect(req.headers.cookie).toBe('sid=xyz');
            });

            test('normalizes lambda-url event with fallback defaults', () => {
                const event = {
                    rawPath: '/default-url',
                    headers: { 'x-forwarded-for': '11.22.33.44' }
                };
                const req = new Request(event, {}, 'aws', 'lambda-url');
                expect(req.method).toBe('GET');
                expect(req.url).toBe('/default-url');
                expect(req.query).toEqual({});
                expect(req.socket.remoteAddress).toBe('11.22.33.44');
            });

            test('falls back to empty remoteAddress in lambda-url', () => {
                const event = { rawPath: '/' };
                const req = new Request(event, {}, 'aws', 'lambda-url');
                expect(req.socket.remoteAddress).toBe('');
            });
        });

        describe('rest subtype', () => {
            test('normalizes API Gateway v1 rest event', () => {
                const event = {
                    httpMethod: 'POST',
                    path: '/users',
                    headers: {
                        Cookie: 'token=secret; dark=1',
                        'x-forwarded-for': '20.30.40.50, 100.200.0.1',
                        'x-forwarded-proto': 'https'
                    },
                    queryStringParameters: { filter: 'active' },
                    pathParameters: { org: 'acme' }
                };
                const req = new Request(event, {}, 'aws', 'rest');
                expect(req.method).toBe('POST');
                expect(req.url).toBe('/users');
                expect(req.query).toEqual({ filter: 'active' });
                expect(req.params).toEqual({ org: 'acme' });
                expect(req.socket.remoteAddress).toBe('20.30.40.50');
                expect(req.socket.encrypted).toBe(true);
                expect(req.headers.cookie).toBe('token=secret; dark=1');
            });

            test('normalizes rest event without Cookie or x-forwarded-for', () => {
                const event = {
                    httpMethod: 'GET',
                    path: '/ping'
                };
                const req = new Request(event, {}, 'aws', 'rest');
                expect(req.method).toBe('GET');
                expect(req.url).toBe('/ping');
                expect(req.query).toEqual({});
                expect(req.params).toEqual({});
                expect(req.socket.remoteAddress).toBe('');
            });
        });
    });

    describe('Azure platform', () => {
        test('normalizes Azure Function context.req with Buffer rawBody', () => {
            const context = {
                req: {
                    method: 'POST',
                    url: '/api/azure',
                    headers: {
                        cookie: 'az1=1; az2=2',
                        'x-forwarded-for': '12.34.56.78',
                        'x-forwarded-proto': 'https'
                    },
                    query: { q: 'search' },
                    params: { resId: '5' },
                    rawBody: Buffer.from('azure buffer body')
                }
            };
            const req = new Request({}, context, 'azure');
            expect(req.method).toBe('POST');
            expect(req.url).toBe('/api/azure');
            expect(req.query).toEqual({ q: 'search' });
            expect(req.params).toEqual({ resId: '5' });
            expect(req.socket.remoteAddress).toBe('12.34.56.78');
            expect(req.socket.encrypted).toBe(true);
            expect(req.headers.cookie).toBe('az1=1; az2=2');
            expect(req.body.toString()).toBe('azure buffer body');
        });

        test('normalizes Azure Function with string rawBody and empty context.req', () => {
            const event = {
                method: 'GET',
                url: '/api/event-azure',
                rawBody: 'string body'
            };
            const req = new Request(event, {}, 'azure');
            expect(req.method).toBe('GET');
            expect(req.url).toBe('/api/event-azure');
            expect(req.headers.cookie).toBeUndefined();
            expect(req.socket.remoteAddress).toBe('');
            expect(req.body.toString()).toBe('string body');
        });

        test('normalizes Azure Function without rawBody', () => {
            const event = { method: 'GET', url: '/api/no-body' };
            const req = new Request(event, {}, 'azure');
            expect(req.body.length).toBe(0);
        });
    });

    describe('GCP platform', () => {
        test('normalizes GCP event with method and url', () => {
            const event = {
                method: 'POST',
                url: '/gcp-func',
                headers: {
                    cookie: 'gcp=ok',
                    'x-forwarded-for': '77.88.99.00',
                    'x-forwarded-proto': 'https'
                },
                query: { env: 'prod' },
                params: { team: 'core' }
            };
            const req = new Request(event, {}, 'gcp');
            expect(req.method).toBe('POST');
            expect(req.url).toBe('/gcp-func');
            expect(req.query).toEqual({ env: 'prod' });
            expect(req.params).toEqual({ team: 'core' });
            expect(req.socket.remoteAddress).toBe('77.88.99.00');
            expect(req.socket.encrypted).toBe(true);
            expect(req.headers.cookie).toBe('gcp=ok');
        });

        test('normalizes GCP event with httpMethod, path and query object', () => {
            const event = {
                httpMethod: 'GET',
                path: '/gcp-path',
                query: { a: 'b', c: 'd' }
            };
            const req = new Request(event, {}, 'gcp');
            expect(req.method).toBe('GET');
            expect(req.url).toBe('/gcp-path?a=b&c=d');
            expect(req.socket.remoteAddress).toBe('');
            expect(req.headers.cookie).toBeUndefined();
        });

        test('normalizes GCP event without query', () => {
            const event = {
                httpMethod: 'GET',
                path: '/gcp-no-query'
            };
            const req = new Request(event, {}, 'gcp');
            expect(req.url).toBe('/gcp-no-query');
        });
    });

    describe('Fallback coverage for method/url/headers/query/params', () => {
        test('triggers fallback when normalized values are falsy', () => {
            const origNormalize = Request._normalize;
            Request._normalize = () => ({
                method: null,
                url: null,
                headers: null,
                query: null,
                pathParams: null,
                rawBodyBuf: null,
                remoteAddress: '',
                isEncrypted: false
            });

            try {
                const req = new Request({});
                expect(req.method).toBe('GET');
                expect(req.url).toBe('/');
                expect(req.headers).toEqual({});
                expect(req.query).toEqual({});
                expect(req.params).toEqual({});
            } finally {
                Request._normalize = origNormalize;
            }
        });

        test('invokes constructor and _normalize with default parameters', () => {
            const RequestConstructor = Request as unknown as {
                new (event?: unknown, context?: unknown): Request;
                _normalize: (event?: unknown) => { method: string; url: string };
            };
            const req = new RequestConstructor();
            expect(req.method).toBe('GET');
            expect(req.url).toBe('/');

            const norm = RequestConstructor._normalize();
            expect(norm.method).toBe('GET');
            expect(norm.url).toBe('/');
        });
    });
});