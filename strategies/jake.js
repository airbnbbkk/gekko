/*

  PPO - cykedev 15/01/2014

  (updated a couple of times since, check git history)

 */

// helpers
var _ = require('lodash');
var log = require('../core/log');
var moment = require('moment');

// let's create our own method
var method = {};


// prepare everything our method needs
method.init = function () {
  this.name = 'PPO';

  this.trend = {
    direction: 'none',
    duration: 0,
    persisted: false,
    adviced: false,
    history: null,
    slope: 0,
    shortPrice: null,
    shortDate:null,
    longPrice: null,
    longDate:null
  };

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('ppo', 'PPO', this.settings);


  var setting = {
    optInTimePeriod: 5
  };

  // add the indicator to the strategy
  this.addTulipIndicator('myLinregslope', 'linregslope', setting);
}

method.check = function () {
  // use indicator results
  var result = this.tulipIndicators.mymacd.result;
  var macddiff = result['macd'] - result['macdSignal'];

  // do something with macdiff
}

// what happens on every new candle?
method.update = function (candle) {
  this.trend.start = candle.start;
  log.debug('new candle', this.trend.start.utc().format('YYYY-MM-DD h:mm:ss a'));

  // nothing!
}

// for debugging purposes log the last
// calculated parameters.
method.log = function () {
  var digits = 8;
  var ppo = this.indicators.ppo;
  var long = ppo.result.longEMA;
  var short = ppo.result.shortEMA;
  var macd = ppo.result.macd;
  var result = ppo.result.ppo;
  var macdSignal = ppo.result.MACDsignal;
  var ppoSignal = ppo.result.PPOsignal;

  var myLinregslope = this.tulipIndicators.myLinregslope;

  log.debug('calculated MACD properties for candle:');
  // log.debug('\t', 'short:', short.toFixed(digits));
  // log.debug('\t', 'long:', long.toFixed(digits));
  // log.debug('\t', 'macd:', macd.toFixed(digits));
  // log.debug('\t', 'macdsignal:', macdSignal.toFixed(digits));
  // log.debug('\t', 'machist:', (macd - macdSignal).toFixed(digits));
  log.debug('\t', 'ppo:', result.toFixed(digits));
  log.debug('\t', 'pposignal:', ppoSignal.toFixed(digits));
  log.debug('\t', 'ppohist:', (result - ppoSignal).toFixed(digits));
  // log.debug('\t', 'history:', this.trend.history);
  log.debug('\t', 'ppoRate:', ((ppo.result.ppo - ppoSignal).toFixed(digits) / this.trend.history) - 1);
  log.debug('\t', 'myLinregslope', myLinregslope.result.result);
  log.debug('\t', 'slopeRate:', ((myLinregslope.result.result).toFixed(digits) / this.trend.slope) - 1);


};

method.check = function (candle) {
  var price = candle.close;

  var ppo = this.indicators.ppo;
  var long = ppo.result.longEMA;
  var short = ppo.result.shortEMA;
  var macd = ppo.result.macd;
  var result = ppo.result.ppo;
  var macdSignal = ppo.result.MACDsignal;
  var ppoSignal = ppo.result.PPOsignal;
  var myLinregslope = this.tulipIndicators.myLinregslope.result.result;


  // TODO: is this part of the indicator or not?
  // if it is it should move there
  var ppoHist = result - ppoSignal;

  log.debug('current price: ', price);
  log.debug('buying price: ', this.trend.longPrice);
  log.debug('selling price: ', this.trend.shortPrice);
  if ((ppoHist / this.trend.history) - 1 > 0 && (myLinregslope / this.trend.slope) - 1 > 0) {

    log.debug('*************** new trend detected *****************');
    if (this.trend.direction !== 'up') {
      Object.assign(this.trend, {
        duration: 0,
        persisted: false,
        direction: 'up',
        adviced: false
      });

      this.trend.duration++;

      log.debug('In uptrend since', this.trend.duration, 'candle(s)');
    }

    if (this.trend.duration >= this.settings.thresholds.persistence) {
      this.trend.persisted = true;
    }

    if (this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      log.debug('++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
      this.advice('long');
      this.trend.longPrice = price;
      this.trend.longDate = candle.start;
    } else {
      this.advice();
    }
  }
  // (ppoHist / this.trend.history) - 1 < 0 && (myLinregslope / this.trend.slope) - 1 < 0 && ((price / this.trend.longPrice) - 1 >= 0.05 || ((price / this.trend.longPrice) - 1 < 0 &&(price / this.trend.longPrice) - 1 >= -0.0000005))

  // log.debug('hours',eval(candle.start), candle.start.format('YYYY MM DD'));
  if ((price / this.trend.longPrice) - 1 >= 0.05 || (moment.duration(candle.start.diff(this.trend.longDate)).asHours() >= 12 && (price / this.trend.longPrice) - 1 <= 0 && (price / this.trend.longPrice) - 1 >= -0.02)) {

    // new trend detected
    if (this.trend.direction !== 'down')
      Object.assign(this.trend, {
        duration: 0,
        persisted: false,
        direction: 'down',
        adviced: false,
        history: ppoHist
      });


    this.trend.duration++;

    log.debug('In downtrend since', this.trend.duration, 'candle(s)');

    if (this.trend.duration >= this.settings.thresholds.persistence)
      this.trend.persisted = true;

    if (this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      log.debug('----------------------------------------------------------------------------------------------------');
      this.advice('short');
      this.trend.shortPrice = price;
      this.trend.shortDate = candle.start;
    } else
      this.advice();


  } else {

    log.debug('In no trend');

    // we're not in an up nor in a downtrend
    // but for now we ignore sideways trends
    //
    // read more @link:
    //
    // https://github.com/askmike/gekko/issues/171

    // this.trend = {
    //   direction: 'none',
    //   duration: 0,
    //   persisted: false,
    //   adviced: false
    // };

    this.advice();
  }

  this.trend.history = ppoHist;
  this.trend.slope = myLinregslope;
};

module.exports = method;
