window.IAT = (function(window, undefined) {
  'use strict';

  // jQuery object based on target element the view should attached itself to.
  var $targetEl;

  // List of JSON files describing data used in each block.
  var testData = [];

  // Stores all answers from consecutive tests.
  var answerStore = [];

  // Styles used throughout all the gui interfaces
  var styles = ('<style>' +
    '#iat-red-cross {' +
      'display:none;' +
      '          opacity:0;' +
      '          position:absolute;' +
      '          z-index: 2;' +
      '          left: 50%;' +
      '          top: 50%;' +
      '          margin-left: -100px;' +
      '          margin-top: -100px;' +
      '          width:200px;height:200px;' +
      '          background:url({{urlBase}}/img/redcross.gif) transparent center no-repeat;' +
    '}' +

    '#iat-container {' +
    'width: 400px;' +
    'height: 150px;' +
    'padding: 10px;' +
    'margin: auto;' +
    'background: white;' +
    'position: relative;' +
    'font-size: 16px;' +
    'line-height: 1.2em;' +
    '}' +

    '.concept {' +
    'font-weight: bold;' +
    '} ' +

    '.key {' +
    'font-weight: bold;' +
    '}' +

    '.proceed-button {' +
    'width: 100px;' +
    'position: absolute;' +
    'left: 50%;' +
    'margin-left: -50px;' +
    'margin-top: 50px;' +
    'font-size: 16px;' +
    '}' +

    '.left-item {' +
      'position: absolute;' +
      'top: 10px;' +
      'left: 10px;' +
    '}' +

    '.right-item {' +
      'position: absolute;' +
      'top: 10px;' +
      'right: 10px;' +
    '}' +

    '.candidate {' +
      'padding-top: 100px;' +
      'padding-bottom: 100px;' +
      'width: 100%;' +
      'text-align: center;' +
      'font-size: 20px;' +
    '}' +
  '</style>');

  // Default message to display before a test
  var defaultSplashMessage = 'In the next test, you will be tasked to associate words with either the concept ' +
    '{{left}}' +
    ' (by pressing the <span class="key">E</span> key) or ' +
    '{{right}}' +
    ' (by pressing the <span class="key">I</span> key).';

  var defaultButtonText = 'proceed';

  /**
   * Start the test.
   *
   * @public
   * @param  {DOMElement} targetEl  Target element the view should attached itself to.
   * @param  {Array}      files     List of JSON files describing data used in each block.
   * @return {void}
   */
  var startIAT = function($root, data, urlBase) {
    testData = data;
    $targetEl = $root;
    updateStyles(urlBase);
    return loadTasks();
  }.bind(this);

  /**
   * Getter method to obtain all the answers.
   *
   * @return {Array}  Reference to the answerStore containing all the recorded answers.
   */
  var getAnswers = function() {
    return answerStore;
  }.bind(this);

  /**
   * Updates assets paths in styles with the given base url
   * @param  {String} urlBase the base url to prepend to assets urls
   */
  function updateStyles(urlBase) {
    if (!urlBase || !urlBase.length) {
      urlBase = '.';
    }

    if (urlBase[urlBase.length - 1] !== '/') {
      urlBase += '/';
    }

    styles = styles.replace('{{urlBase}}', urlBase);
  }

  /**
   * Displays an splash screen before starting a test block
   * @param  {left: <left-concept>: right: <right-concept>} data about the test block
   */
  function showSplash(splashData, data) {
    var message;
    var buttonText;
    var splashDone = $.Deferred();

    if (!splashData) {
      splashDone.resolve();
      return splashDone.promise();
    }

    if (
      splashData.message &&
      typeof splashData.message === 'string'
    ) {
      message = splashData.message;
    } else {
      message = defaultSplashMessage;
    }

    if (
      splashData.buttonText &&
      typeof splashData.buttonText === 'string'
    ) {
      buttonText = splashData.buttonText;
    } else {
      buttonText = defaultButtonText;
    }

    message = message.replace('{{left}}', '<span class="concept">' + data.left + '</span>');
    message = message.replace('{{right}}', '<span class="concept">' + data.right + '</span>');

    $targetEl.html(
      styles +
      '<div id="iat-container">' +
        message +
        '<input type="button" value="' + buttonText + '" class="proceed-button"/>' +
      '</div>');
    $('.proceed-button').click(function(event) {
      event.preventDefault();
      splashDone.resolve();
    });

    return splashDone.promise();
  }

  /**
   * Update the UI's texts with the given test data
   * @param {Object} data test data that will be displayed
   */
  function updateUI(data) {
    $targetEl.html(
      styles +
      '<div id="iat-container">' +
      '  <div class="left-item concept">' +
          data.left +
      '  </div>' +
      '  <div class="right-item concept">' +
          data.right +
      '  </div>' +
      '  <div class="candidate">' +
          data.candidate +
      '  </div>' +
      '  <div id="iat-red-cross"' +
      '  </div>' +
      '</div>'
    );
  }

  /**
   * Display red cross image feedback.
   *
   * @param  {boolean} display  Whether to display image or not.
   * @return {void}
   */
  function displayRedCrossFeedback(display) {
    var $redCross = $('#iat-red-cross');

    if (display) {
      $redCross.css('display', 'block').animate({opacity: 1}, 500);
    } else {
      $redCross.animate({opacity: 0}, 500, function() {
        $redCross.css('display', 'none');
      });
    }
  }

  /**
   * Consume the array of JSON files describing the trials
   * to start the cycle of tests.
   *
   * @return {void}
   */
  function loadTasks() {
    var currentTaskIndex = 0;
    var countTask = testData.length;

    var loadTask = function(taskIndex) {
      if (taskIndex < countTask) {
        currentTaskIndex++;
        var data = testData[taskIndex];
        return start(data).then(function(answers) {
          answerStore.push(answers);
          return loadTask(currentTaskIndex);
        });
      } else {
        console.log('[IAT] Test is finished.');
        console.log(answerStore);
        return answerStore;
      }
    };

    return loadTask(0);
  }

  /**
   * Start the application when data is loaded and ready.
   *
   * @param {Object} data  The data parsed from JSON.
   */
  function start(data) {
    // Store jQuery-wrapped `window`,
    // key codes constants for `E` and `I` keys,
    // and a dictionnary for those keys so that
    // we can bind in our code the keys to the
    // words of `left` and `right`.
    // Set the default timespace allowed for
    // answering a trial.
    var $win = $(window);
    var KEYCODE_E_LEFT = 69;
    var KEYCODE_I_RIGHT = 73;
    var KEYS = {};
    var DEFAULT_ANSWER_TIMESPAN = 10;

    KEYS[KEYCODE_E_LEFT] = 'left';
    KEYS[KEYCODE_I_RIGHT] = 'right';

    /**
     * Timer for measuring user input speed.
     * It's a self-correcting timer to compense for the latency
     * induced by depending upon CPU time (which itself is
     * dependant on its current load).
     *
     * @see http://www.sitepoint.com/creating-accurate-timers-in-javascript/
     */
    var Timer = (function() {
      var startTime = new Date().getTime();
      var time = 0;
      var elapsed = 0;
      var timer = null;

      // Process calculations with auto-correction.
      var instance = function() {
        time += 100;
        elapsed = (time / 100) / 10;
        var diff = (new Date().getTime() - startTime) - time;
        window.setTimeout(instance, (100 - diff));
      }.bind(this);

      // Starts the timer.
      var start = function() {
        if (startTime === null) {
          startTime = new Date().getTime();
        }

        time = 0;
        elapsed = 0;
        timer = window.setTimeout(instance, 100);
      }.bind(this);

      // Stops the timer.
      var stop = function() {
        startTime = null;
        clearTimeout(timer);
      }.bind(this);

      // Return elpased time.
      var getElapsed = function() {
        return elapsed;
      };

      // Public API.
      return {
        start: start,
        stop: stop,
        getElapsed: getElapsed,
      };
    })();

    /**
     * Create and display a practice block.
     * A practice block is a block with either a pair of concepts
     * OR a pair of evaluation (but not both at the same time!),
     * set in top of the left and right halves of the screen.
     *
     * @param  {Object} blockData  {test:{type:String, items:Array}, splashMessage: ''}
     *
     * @return {Object}  An object built upon a scoped construction.
     * Provides an `start` method, returns a promise. The `start` method will run
     * the entire block of trials till the end. Once resolved, the promise will take
     * a function and pass it an object holding the results of challenge.
     */
    function createBlock(blockData) {

      return (function(blockData) {
        var setA = blockData.test[0];
        var setB = blockData.test[1];
        var displayedChoices = getDisplayableChoices(setA, setB);
        var totalTrials = setA.items.length + setB.items.length;
        var currentTrial = 0;
        var preparedSet = prepareSets(setA, setB);
        var deferred = $.Deferred();
        var pressedBtn = null;
        var answerMeasureTimer = null;
        var answerLimitTimer = null;
        var answers = {
          results: [],
          errors: [],
        };

        /**
         * Displays the next trial.
         * Deals with all things related to the trial's lifespan, including displaying
         * the screen, capturing user input and timing her reply, displaying feedback
         * on wrong answers and resetting the trial, storing errors...
         *
         * @return {void}
         */
        var displayNextTrial = function() {
          /**
           * Provides a defined timespan for the user to input her answer.
           * If user does not answer within the timespan, display an error feedback.
           *
           * @param {integer} seconds      The amount of time to answer, in seconds.
           * @param {Object}  item         An object plucked for the list of objects used
           *                               to create a new trial.
           * @param {Object} measureTimer  An instance of the Timer to measure user input.
           *
           * @return {void}
           */
          var setTimerForAnswer = function(seconds, item, measureTimer) {
            $win.on('keyup', keyupHandler);

            // Measure time taken to answer.
            answerMeasureTimer = Timer;
            answerMeasureTimer.start();

            // Time limit to answer.
            answerLimitTimer = _.delay(function() {
              $win.off('keyup', keyupHandler);
              if (!pressedBtn) {
                wrongAnswerFeedback(item, answerMeasureTimer.getElapsed());
              }
            }.bind(this), seconds * 1000);
          }.bind(this);

          /**
           * Resets the answer timer (the timer monitoring the timespan within which
           * user has to provide her answer). Resets a bunch of answer-related
           * variables as well.
           *
           * @return {void}
           */
          function resetAnswer() {
            clearTimeout(answerLimitTimer);
            displayRedCrossFeedback(false);
            $win.off('keyup', keyupHandler);
            answerMeasureTimer.stop();
            answerMeasureTimer = null;
            pressedBtn = null;
          }

          /**
           * Key up event handler monitoring user input.
           * If, during the current turn, no input was already caught,
           * and user has pressed keys `E` or Ì`, decide based on the
           * input whether we validate the answer or not,
           * and act accordingly.
           * Store the results along the way.
           *
           * @param  {Object} e  A jQuery.Event object passed during the event.
           * @return {void}
           */
          function keyupHandler(e) {
            if (!pressedBtn) {
              if (e.keyCode === KEYCODE_E_LEFT || e.keyCode === KEYCODE_I_RIGHT) {
                pressedBtn = e.keyCode;
                var time = answerMeasureTimer.getElapsed();
                if (displayedChoices[KEYS[pressedBtn]] === pluckedItem.type) {
                  resetAnswer();
                  answers.results.push({
                    trial: pluckedItem,
                    time: time,
                    choices: displayedChoices,
                  });
                  displayNextTrial();
                } else {
                  wrongAnswerFeedback(pluckedItem, time, displayedChoices);
                }
              }
            }
          }

          /**
           * Helper function to display feedback on wrong answer (or if user timed out).
           * @param  {Object}  currentItem  An object plucked for the list of objects used
           *                                to create a new trial.
           * @param  {integer} time         Time the user took to provide the answer.
           * @param  {Object}  choices      The object containing evalutations/concepts choices
           *                                (i.e. what's displayed on screen halves).
           * @return {void}
           */
          var wrongAnswerFeedback = function(currentItem, time, choices) {
            console.log('[IAT] WRONG OR MISSING!');
            answers.errors.push({ trial: currentItem, time: time, choices: choices });
            displayRedCrossFeedback(true);
            resetAnswer();
            setTimerForAnswer(10, currentItem);
          };

          // Run for as long as there will be items available.
          if (preparedSet.length > 0) {

            // On each turn, get a random element from the array of items
            // and shrink the array by doing so. Do all that at low cost.
            var randIndex = Math.floor(Math.random() * (preparedSet.length - 1));
            var firstItem = preparedSet[0];
            var randItem = preparedSet[randIndex];

            preparedSet[0] = randItem;
            preparedSet[randIndex] = firstItem;

            var pluckedItem = preparedSet.shift();

            updateUI({
              left: displayedChoices.left,
              right: displayedChoices.right,
              candidate: pluckedItem.item,
            });
            console.log(
              '[IAT] Left screen is "' +
              displayedChoices.left +
              '", right screen is "' +
              displayedChoices.right + '".'
            );
            console.log(
              '[IAT] Stimuli displayed is "' + pluckedItem.item + '" (' + pluckedItem.type + ').'
            );

            // Let the user suggest an answer.
            setTimerForAnswer(DEFAULT_ANSWER_TIMESPAN, pluckedItem);
          } else {
            // If no more trials, resolve the promise with a payload of results.
            console.log('[IAT] Finished block.');
            deferred.resolve(answers);
          }

        }.bind(this);

        var startBlock = function() {
          console.log('[IAT] Starting practice block.');

          showSplash(
              blockData.splash,
              {
                left: displayedChoices.left,
                right: displayedChoices.right,
                candidate: '',
              }
            )
            .then(function() {
              return displayNextTrial();
            });

          return deferred.promise()
            .then(function() {
              return showSplash(blockData.post, {
                left: displayedChoices.left,
                right: displayedChoices.right,
                candidate: '',
              });
            });
        };

        // Public API.
        return {
          start: startBlock,
        };
      })(blockData);

    }

    /**
     * Get a readable digest of the elements to display on
     * the left and right halves of the screen.
     *
     * @param  {rest...} sets  Rest parameters. Each element must be object
     *                         following this nomenclatura: {type:String, items:Array}.
     * @return {Object}  An object containing keys `left` and `right` mentioning
     * as strings the name of evaluations/concepts to display.
     */
    function getDisplayableChoices(sets) {
      var args = [].slice.call(arguments);

      if (args.length === 2) {
        return {
          left: args[0].type,
          right: args[1].type,
        };
      }

      console.error('[IAT] Something went wrong when attempting to display choices.');
    }

    /**
     * Prepare given sets of data in a stack of objects usable for trials.
     *
     * @param  {rest...} sets  Rest params. Each element must be object
     *                         following this nomenclatura: {type:String, items:Array}.
     * @return {array}  A stack of objects.
     */
    function prepareSets(sets) {
      var args = [].slice.call(arguments);
      var result = [];

      _.each(args, function(set) {
        var items = set.items;
        _.each(items, function(item) {
          result.push({ type: set.type, item: item });
        });
      });

      return result;
    }

    /**
     * Return the created block as a promise.
     */
    return createBlock(data).start();

  }

  return {
    start: startIAT,
    getAnswers: getAnswers,
  };

})(window, undefined);
