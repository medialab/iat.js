'use strict';

window.IAT = (function(window, undefined) {

  // jQuery object based on target element the view should attached itself to.
  var $targetEl;

  // List of JSON files describing data used in each block.
  var dataFiles = [];

  // Stores all answers from consecutive tests.
  var answerStore = [];

  /**
   * Start the test.
   *
   * @public
   * @param  {DOMElement} targetEl  Target element the view should attached itself to.
   * @param  {Array}      files     List of JSON files describing data used in each block.
   * @return {void}
   */
  var startIAT = function(targetEl, files) {
    $targetEl = $(targetEl);
    dataFiles = files;
    loadTasks();
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
   * Promise to load JSON data.
   *
   * @param  {String} fileUri  Path to the file to load.
   * @return {Object} Promise resolving loaded data.
   */
  function loadJSON(fileUri) {
    var deferred = $.Deferred();

    $.ajax({
      dataType: 'json',
      url: fileUri,
    }).fail(function() {
      console.log('[IAT] Failed loading data from ' + fileUri + '.');
      deferred.reject();
    }).done(function(data) {
      console.log('[IAT] Loaded "' + fileUri + '".');
      deferred.resolve(data);
    });

    return deferred.promise();
  }

  /**
   * Consume the array of JSON files describing the trials
   * to start the cycle of tests.
   *
   * @return {void}
   */
  function loadTasks() {
    var currentTaskIndex = 0;
    var countTask = dataFiles.length;

    var loadTask = function(taskIndex) {
      if (taskIndex < countTask) {
        currentTaskIndex++;
        $.when(loadJSON(dataFiles[taskIndex]))
         .then(function(data) {
           start(data).then(function(answers) {
             answerStore.push(answers);
             loadTask(currentTaskIndex);
           });
         });
      } else {
        console.log('[IAT] Test is finished.');
      }
    }

    loadTask(0);
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
     * @param  {Array} pairedSetsInArray  An array of two objects each following
     *                                    this nomenclatura: {type:String, items:Array}.
     *
     * @return {Object}  An object built upon a scoped construction.
     * Provides an `start` method, returns a promise. The `start` method will run
     * the entire block of trials till the end. Once resolved, the promise will take
     * a function and pass it an object holding the results of challenge.
     */
    function createBlock(pairedSetsInArray) {

      return (function(pairedSetsInArray) {
        var setA = pairedSetsInArray[0];
        var setB = pairedSetsInArray[1];
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
              if (e.keyCode === KEYCODE_E_LEFT || e.keyCode === KEYCODE_I_RIGHT) {
                pressedBtn = e.keyCode;
                var time = answerMeasureTimer.getElapsed();
                if (displayedChoices[KEYS[pressedBtn]] === pluckedItem.type) {
                  resetAnswer();
                  answers.results.push({
                    trial: pluckedItem,
                    time: time, choices:
                    displayedChoices
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

            console.log(
              '[IAT] Left screen is "'
              + displayedChoices.left
              + '", right screen is "'
              + displayedChoices.right + '".'
            );
            console.log(
              '[IAT] Stimuli displayed is "' + pluckedItem.item + '" (' + pluckedItem.type + ').'
            );

            // Let the user proposes an answer.
            setTimerForAnswer(DEFAULT_ANSWER_TIMESPAN, pluckedItem);
          } else {

            // If nore more trials, resolve the promise with a payload of results.
            console.log('[IAT] Finished block.');
            deferred.resolve(answers);
          };
        }.bind(this);

        // Start the block.
        var start = function() {
          console.log('[IAT] Starting practice block.');
          displayNextTrial();
          return deferred.promise();
        };

        // Public API.
        return {
          start: start,
        };
      })(pairedSetsInArray);

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
    return createBlock(data.evaluations).start();

  }

  return {
    start: startIAT,
    getAnswers: getAnswers
  }

})(window, undefined);
