import { normalizeHeaders, normalizeHeadersGeneral, resolveWithRequire } from '../src/utils';
import path from 'path';

describe('serverless utils.js', () => {
    describe('normalizeHeadersGeneral', () => {
        test('normalizes headers with array values and single values', () => {
            const input = {
                'Content-Type': 'application/json',
                'Accept': ['text/html', 'application/xhtml+xml'],
                'X-Custom': 123
            };
            const res = normalizeHeadersGeneral(input);
            expect(res).toEqual({
                'Content-Type': 'application/json',
                'Accept': 'text/html, application/xhtml+xml',
                'X-Custom': 123
            });
        });
    });

    describe('normalizeHeaders', () => {
        test('returns empty object when headers is null, undefined, or not an object', () => {
            expect(normalizeHeaders(null, 'generic')).toEqual({});
            expect(normalizeHeaders(undefined, 'generic')).toEqual({});
            expect(normalizeHeaders('string', 'generic')).toEqual({});
        });

        test('throws on unknown platform', () => {
            expect(() => normalizeHeaders({ a: '1' }, 'unknown-plat')).toThrow('Unknown platform: unknown-plat');
        });

        test('throws when aws subtype is missing or unknown', () => {
            expect(() => normalizeHeaders({ a: '1' }, 'aws')).toThrow('AWS subtype is required: http, rest, alb, lambda-url, cloudfront, event');
            expect(() => normalizeHeaders({ a: '1' }, 'aws', 'invalid-subtype')).toThrow('AWS subtype is required: http, rest, alb, lambda-url, cloudfront, event');
        });

        test('supportsArray for aws subtypes', () => {
            const arrHeaders = { 'Accept': ['text/html', 'application/json'], 'Set-Cookie': ['a=1', 'b=2'] };
            
            // http, alb, lambda-url, cloudfront support array
            ['http', 'alb', 'lambda-url', 'cloudfront'].forEach(sub => {
                const res = normalizeHeaders(arrHeaders, 'aws', sub);
                expect(res['accept']).toEqual(['text/html', 'application/json']);
                expect(res['set-cookie']).toEqual(['a=1', 'b=2']);
            });

            // rest and event do not support array
            const restRes = normalizeHeaders(arrHeaders, 'aws', 'rest');
            expect(restRes['accept']).toBe('text/html, application/json');
            expect(restRes['set-cookie']).toBe('a=1');

            const eventRes = normalizeHeaders(arrHeaders, 'aws', 'event');
            expect(eventRes['accept']).toBe('text/html, application/json');
            expect(eventRes['set-cookie']).toBe('a=1');
        });

        test('supportsArray for gcp, azure, local, generic', () => {
            const headers = {
                'X-Header': ['val1', 'val2'],
                'Single': 'value'
            };
            ['gcp', 'azure', 'local', 'generic'].forEach(plat => {
                const res = normalizeHeaders(headers, plat);
                expect(res['x-header']).toEqual(['val1', 'val2']);
                expect(res['single']).toBe('value');
            });
        });

        test('ignores inherited properties on prototype', () => {
            const proto = { inherited: 'val' };
            const obj = Object.create(proto);
            obj.own = 'mine';
            const res = normalizeHeaders(obj, 'generic');
            expect(res).toEqual({ own: 'mine' });
        });
    });

    describe('resolveWithRequire', () => {
        test('resolves file when path is valid', () => {
            const res = resolveWithRequire('utils.normalizeHeaders', __dirname + '/../src');
            expect(res).toBe(path.resolve(__dirname, '../src/utils.ts'));
        });

        test('returns null when file does not exist', () => {
            const res = resolveWithRequire('nonExistentModule.handler', __dirname);
            expect(res).toBeNull();
        });
    });
});
