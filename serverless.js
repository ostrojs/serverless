
const StreamRequest = require('./stream/request');
const StreamResponse = require('./stream/response');
const { resolveWithRequire } = require("./utils")
class Serverless {
	constructor({ serverless }) {
		this.stream();
		const handler = this.handle()
		Object.defineProperties(this, {
			handler: {
				value: handler
			},
			$config: {
				value: serverless
			}
		});

		this.entry(resolveWithRequire(serverless.handler))
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
		return (event, context) => {
			return new Promise((resolve) => {
				const serverlessPlateform = this.$config.platform || "generic";
				const serverlessGetway = this.$config.gateway;
				const request = new this.$request(new this.$streamRequest(event, context, serverlessPlateform, serverlessGetway));
				const response = new this.$response(new this.$streamResponse(resolve, serverlessPlateform, serverlessGetway))
				Object.defineProperty(response, 'request', { value: request })
				this.$handler(request, response, (err) => {
					response.send(err)
				});
			});
		};
	}

	entry(entryPath) {
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
}

module.exports = Serverless;
