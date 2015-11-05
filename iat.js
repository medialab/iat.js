'use strict';

$(function (window, undefined) {

  /**
   * Load JSON data.
   */
  $.ajax({
    dataType: 'json',
    url: 'data.json'
  }).fail(function () {
    console.log('[IAT] Failed loading data.');
  }).done(init);

  /**
   * Start the application when data is loaded and ready.
   */
  function init (data) {

    // Store jQuery-wrapped `window`,
    // key codes constants for `E` and `I` keys,
    // and a dictionnary for those keys so that
    // we can bind in our code the keys to the
    // words of `left` and `right`.
    // Set the default timespace allowed for
    // answering a trial.
    var $win = $(window),
        KEYCODE_E_LEFT = 69,
        KEYCODE_I_RIGHT = 73,
        KEYS = {},
        DEFAULT_ANSWER_TIMESPAN = 10;

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
    var Timer = (function () {
      var startTime = new Date().getTime(),
          time = 0,
          elapsed = 0,
          timer = null;

      // Process calculations with auto-correction.
      var instance = function () {
        time += 100;
        elapsed = (time / 100) / 10;
        var diff = (new Date().getTime() - startTime) - time;
        window.setTimeout(instance, (100 - diff));
        console.log(elapsed)
      }.bind(this);

      // Starts the timer.
      var start = function () {
        if (startTime === null) {
          startTime = new Date().getTime();
        }
        time = 0;
        elapsed = 0;
        timer = window.setTimeout(instance, 100);
      }.bind(this);

      // Stops the timer.
      var stop = function () {
        startTime = null;
        clearTimeout(timer);
      }.bind(this);

      // Return elpased time.
      var getElapsed = function () {
        return elapsed;
      };

      // Public API.
      return {
        start: start,
        stop: stop,
        getElapsed: getElapsed
      }
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
    function createPracticeBlock(pairedSetsInArray) {

      return (function (pairedSetsInArray) {
        var setA = pairedSetsInArray[0],
            setB = pairedSetsInArray[1],
            displayedChoices = getDisplayableChoices(setA, setB),
            totalTrials = setA.items.length + setB.items.length,
            currentTrial = 0,
            preparedSet = prepareSets(setA, setB),
            deferred = $.Deferred(),
            pressedBtn = null,
            answerMeasureTimer = null,
            answerLimitTimer = null;

        /**
         * Displays the next trial.
         * Deals with all things related to the trial's lifespan, including displaying
         * the screen, capturing user input and timing her reply, displaying feedback
         * on wrong answers and resetting the trial, storing errors...
         *
         * @return {void}
         */
        var displayNextTrial = function () {

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
          var setTimerForAnswer = function (seconds, item, measureTimer) {
            $win.on('keyup', keyupHandler);

            // Measure time taken to answer.
            answerMeasureTimer = Timer;
            answerMeasureTimer.start();

            // Time limit to answer.
            answerLimitTimer = _.delay(function () {
              $win.off('keyup', keyupHandler);
              if (!pressedBtn) {
                wrongAnswerFeedback(item);
              }
            }.bind(this), seconds * 1000)
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
           *
           * @param  {Object} e  A jQuery.Event object passed during the event.
           * @return {void}
           */
          function keyupHandler(e) {
            if (!pressedBtn) {
              if (e.keyCode === KEYCODE_E_LEFT || e.keyCode === KEYCODE_I_RIGHT) {
                pressedBtn = e.keyCode;
                if (displayedChoices[KEYS[pressedBtn]] === pluckedItem.type) {
                  console.log(answerMeasureTimer.getElapsed())
                  resetAnswer();
                  displayNextTrial();
                } else {
                  wrongAnswerFeedback();
                }
              }
            }
          }

          /**
           * Helper function to display feedback on wrong answer (or if user timed out).
           * @param  {Object} currentItem  An object plucked for the list of objects used
           *                               to create a new trial.
           * @return {void}
           */
          var wrongAnswerFeedback = function (currentItem) {
            console.log('[IAT] WRONG OR MISSING!');
            resetAnswer();
            setTimerForAnswer(10, currentItem);
          };

          // Run for as long as there will be items available.
          if (preparedSet.length > 0) {

            // On each turn, get a random element from the array of items
            // and shrink the array by doing so. Do all that at low cost.
            var randIndex = Math.floor(Math.random() * (preparedSet.length - 1)),
                firstItem = preparedSet[0],
                randItem = preparedSet[randIndex];

            preparedSet[0] = randItem;
            preparedSet[randIndex] = firstItem;

            var pluckedItem = preparedSet.pop();

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
            console.log('[IAT] Finished block.')
            deferred.resolve(preparedSet); // TODO: return results.
          };
        }.bind(this);

        // Start the block.
        var start = function () {
          console.log('[IAT] Starting practice block.');
          displayNextTrial();
          return deferred.promise();
        };

        // Public API.
        return {
          start: start
        }
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
          right: args[1].type
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
      var args = [].slice.call(arguments),
          result = [];

      _.each(args, function (set) {
        var items = set.items;
        _.each(items, function (item) {
          result.push({ type: set.type, item: item });
        });
      });

      return result;
    }


    /**
     * Start the first (practice) block.
     */
    var practiceBlock1 = createPracticeBlock(data.evaluations);
    practiceBlock1
      .start()
      .then(function (data) {
        console.log(data);
      });

  }

}(window, undefined));
