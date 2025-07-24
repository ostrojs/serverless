const { values } = require('lodash');
const StreamRequest = require('./stream/request');
const StreamResponse = require('./stream/response');

class Serverless {
	constructor({ serverless }) {
		this.stream();
		const handler = this.handle()
		Object.defineProperty(this, "handler", {
			value: (event, context) => {
				return handler(event, context);
			}
		})
		Object.defineProperty(this, "$platform", {
			value: serverless?.platform || "generic",
		})
		Object.defineProperty(this, "$getwayType", {
			value: serverless?.getway,
		})
	}

	stream(request = StreamRequest, response = StreamResponse) {
		if (typeof request != 'function') {
			throw new Error('Request class must be function/class');
		}
		if (typeof response != 'function') {
			throw new Error('Response class must function/class');
		}
		Object.defineProperties(this, {
			$streamRequest: {
				value: request,
				writable: true,
				enumerable: false
			},
			$streamResponse: {
				value: response,
				writable: true,
				enumerable: false
			}
		});
	}

	request(HttpRequest) {
		if (typeof HttpRequest != 'function') {
			throw new Error('HttpRequest class must be function/class')
		}
		Object.defineProperty(this, '$request', { value: HttpRequest })
	}

	response(HttpResponse) {
		if (typeof HttpResponse != 'function') {
			throw new Error('HttpResponse class must function/class')
		}
		Object.defineProperty(this, '$response', { value: HttpResponse })
	}

	register(handler) {
		Object.defineProperty(this, '$handler', { value: handler })
	}

	handle() {
		if (!this.$entryPath) {
			this.loadMainModule(process.cwd() + '/serverless.js');
		}
		return (event, context) => {
			return new Promise((resolve) => {
				const request = new this.$request(new this.$streamRequest(event, context, this.$platform, this.$getwayType));
				const response = new this.$response(new this.$streamResponse(resolve, this.$platform, this.$getwayType))
				Object.defineProperty(response, 'request', { value: request })
				this.$handler(request, response, (err) => {
					this.next(err, resolve);
				});
			});
		};
	}

	entry(entryPath) {
		this.$entryPath = entryPath;
		this.loadMainModule(entryPath);
	}
	loadMainModule(mainModulePath) {
		const mainPath = path.resolve(mainModulePath);
		const mainModule = require(mainPath);
		Object.defineProperty(require, 'main', {
			value: require.cache[mainPath] || null,
			writable: false,
			configurable: false,
			enumerable: true
		});

		process.mainModule = require.main;

		return mainModule;
	}

	next(err, resolve) {
		if (err) {
			resolve({
				statusCode: 500,
				body: JSON.stringify({ message: 'Internal Server Error' }),
			});
		} else {
			resolve({
				statusCode: 404,
				body: JSON.stringify({ message: 'Not Found' }),
			});
		}
	};
}

module.exports = Serverless;
