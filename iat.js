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
    var $win = $(window),
        KEYCODE_E_LEFT = 69,
        KEYCODE_I_RIGHT = 73,
        KEYS = {};

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

      var instance = function () {
        time += 100;
        elapsed = (time / 100) / 10;
        var diff = (new Date().getTime() - startTime) - time;
        window.setTimeout(instance, (100 - diff));
        console.log(elapsed)
      }.bind(this);

      var start = function () {
        if (startTime === null) {
          startTime = new Date().getTime();
        }
        time = 0;
        elapsed = 0;
        timer = window.setTimeout(instance, 100);
      }.bind(this);

      var stop = function () {
        startTime = null;
        clearTimeout(timer);
      }.bind(this);

      var getElapsed = function () {
        return elapsed;
      };

      return {
        start: start,
        stop: stop,
        getElapsed: getElapsed
      }
    })();

    function createPracticeBlock(pairedSetsInArray) {

      return (function (pairedSetsInArray) {
        var setA = pairedSetsInArray[0],
            setB = pairedSetsInArray[1],
            displayedChoices = getDisplayableChoices(setA, setB),
            totalTrials = setA.items.length + setB.items.length,
            currentTrial = 0,
            preparedSet = prepareSets(setA, setB),
            deferred = $.Deferred();

        var displayNextTrial = function () {
          if (preparedSet.length > 0) {

            var wrongAnswerFeedback = function (currentItem) {
              console.log('[IAT] WRONG OR MISSING!');
              resetAnswer();
              setTimerForAnswer(10, currentItem);
            };

            var randIndex = Math.floor(Math.random() * (preparedSet.length - 1)),
                firstItem = preparedSet[0],
                randItem = preparedSet[randIndex],
                pressedBtn = null,
                answerLimitTimer = null,
                answerMeasureTimer = null;

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

            setTimerForAnswer(10, pluckedItem);

            function setTimerForAnswer(time, item) {
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
              }.bind(this), time * 1000);
            };

            function resetAnswer() {
              clearTimeout(answerLimitTimer);
              $win.off('keyup', keyupHandler);
              answerMeasureTimer.stop();
              answerMeasureTimer = null;
              pressedBtn = null;
            }

            function keyupHandler(e) {
              if (!pressedBtn) {
                if (e.keyCode === KEYCODE_E_LEFT || e.keyCode === KEYCODE_I_RIGHT) {
                  pressedBtn = e.keyCode;
                  console.log(answerMeasureTimer)
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
          } else {
            console.log('[IAT] Finished block.')
            deferred.resolve(preparedSet);
          };
        }.bind(this);

        var start = function () {
          console.log('[IAT] Starting practice block.');
          displayNextTrial();
          return deferred.promise();
        };

        return {
          start: start
        }
      })(pairedSetsInArray);

    }

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

    var practiceBlock1 = createPracticeBlock(data.evaluations);
    practiceBlock1
      .start()
      .then(function (data) {
        console.log(data);
      });

  }

}(window, undefined));
