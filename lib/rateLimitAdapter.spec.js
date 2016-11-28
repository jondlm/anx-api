/* eslint func-names: 0, padded-blocks: 0 */

var _ = require('lodash');
var nock = require('nock');
var sinon = require('sinon');

var AnxApi = require('./api');

describe('Rate Limit Adapter', function() {

	var onRateLimitExceededStub;
	var onRateLimitPauseStub;
	var onRateLimitResumeStub;

	beforeAll(function() {
		onRateLimitExceededStub = sinon.stub();
		onRateLimitPauseStub = sinon.stub();
		onRateLimitResumeStub = sinon.stub();
	});

	beforeEach(function() {
		nock.cleanAll();
		onRateLimitExceededStub.reset();
		onRateLimitPauseStub.reset();
		onRateLimitResumeStub.reset();
	});

	it('should handle RateLimitExceededError', function(done) {

		nock('http://api.example.com')
			.get('/limit').once().reply(405, {}, {
				'retry-after': '1',
				'x-ratelimit-read': '1000',
				'x-ratelimit-system': '1000-Default',
				'x-ratelimit-write': '1000',
			})
			.get('/limit').once().reply(200, {}, {});

		var api = new AnxApi({
			target: 'http://api.example.com',
			rateLimiting: true,
			onRateLimitExceeded: onRateLimitExceededStub,
			onRateLimitPause: onRateLimitPauseStub,
			onRateLimitResume: onRateLimitResumeStub,
		});

		api.get('/limit').then(function() {
			return done(_.attempt(function() {
				expect(onRateLimitExceededStub.calledOnce, 'onRateLimitExceededStub called once').to.true;
				expect(onRateLimitPauseStub.calledOnce, 'onRateLimitPauseStub called once').to.true;
				expect(onRateLimitResumeStub.calledOnce, 'onRateLimitResumeStub called once').to.true;
			}, {}));
		}).catch(done);

	});

	it('should adapt up limits', function(done) {

		nock('http://api.example.com')
			.get('/limit').once().reply(200, {}, {
				'x-ratelimit-read': '6',
				'x-ratelimit-system': '1000-Default',
				'x-ratelimit-write': '1000',
			})
			.get('/limit').once().reply(200, {}, {});

		var api = new AnxApi({
			target: 'http://api.example.com',
			rateLimiting: true,
			rateLimitReadSeconds: 1,
			onRateLimitExceeded: onRateLimitExceededStub,
			onRateLimitPause: onRateLimitPauseStub,
			onRateLimitResume: onRateLimitResumeStub,
		});

		api.get('/limit').then(function() {
			return api.get('/limit').then(function() {
				return done(_.attempt(function() {
					expect(onRateLimitExceededStub.calledOnce, 'onRateLimitExceededStub called once').to.false;
					expect(onRateLimitPauseStub.calledOnce, 'onRateLimitPauseStub called once').to.false;
					expect(onRateLimitResumeStub.calledOnce, 'onRateLimitResumeStub called once').to.false;
				}, {}));
			});
		}).catch(done);

	});

	it('should adapt down limits', function(done) {

		nock('http://api.example.com')
			.get('/limit').once().reply(200, {}, {
				'x-ratelimit-read': '1',
				'x-ratelimit-system': '1000-Default',
				'x-ratelimit-write': '1000',
			})
			.get('/limit').once().reply(200, {}, {});

		var api = new AnxApi({
			target: 'http://api.example.com',
			rateLimiting: true,
			rateLimitReadSeconds: 2,
			onRateLimitExceeded: onRateLimitExceededStub,
			onRateLimitPause: onRateLimitPauseStub,
			onRateLimitResume: onRateLimitResumeStub,
		});

		api.get('/limit').then(function() {
			return api.get('/limit').then(function() {
				return done(_.attempt(function() {
					expect(onRateLimitExceededStub.calledOnce, 'onRateLimitExceededStub called once').to.false;
					expect(onRateLimitPauseStub.calledOnce, 'onRateLimitPauseStub called once').to.true;
					expect(onRateLimitResumeStub.calledOnce, 'onRateLimitResumeStub called once').to.true;
				}, {}));
			});
		}).catch(done);

	});

	it('should limit multiple requests', function(done) {

		nock('http://api.example.com')
			.get('/limit').reply(200, {}, {})
			.get('/limit').reply(200, {}, {})
			.get('/limit').reply(200, {}, {});

		var api = new AnxApi({
			target: 'http://api.example.com',
			rateLimiting: true,
			rateLimitRead: 1,
			rateLimitReadSeconds: 1,
			onRateLimitExceeded: onRateLimitExceededStub,
			onRateLimitPause: onRateLimitPauseStub,
			onRateLimitResume: onRateLimitResumeStub,
		});

		Promise.all([
			api.get('/limit'),
			api.get('/limit'),
			api.get('/limit'),
		]).then(function() {
			return done(_.attempt(function() {
				expect(onRateLimitExceededStub.calledOnce, 'onRateLimitExceededStub called once').to.false;
				expect(onRateLimitPauseStub.calledTwice, 'onRateLimitPauseStub called once twice').to.true;
				expect(onRateLimitResumeStub.calledTwice, 'onRateLimitResumeStub called twice').to.true;
			}, {}));
		}).catch(done);

	});

});