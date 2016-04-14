////////global variables//////////

var twitchSwitchApp;
var ang_history_scope = undefined;

//////////////////////////////////

///////////prog init//////////////
init_angular();
document.addEventListener('DOMContentLoaded', init);
//////////////////////////////////

/**
 * Initializes all angular controls for the web page
 */
function init_angular() {
    bglog("init_angular()");
	twitchSwitchApp = angular.module("twitchSwitch", []);
    var streamerListController = twitchSwitchApp.controller("streamerListController", function ($scope) {
        $scope.streamers = [];

        $scope.add_streamer_single = function (name, visited_count) {
            $scope.streamers.push({
                "name" : name,
                "visited_count" : visited_count
            });
            save_streamer_prefs();
        }
        
        // generate history of streamers watched
        $scope.get_history_permission = function() {
            // populate history
            chrome.permissions.contains({
                permissions : ["history"]
            }, history_callback);
        }
        $scope.set_arr = function(arr){
            $scope.streamers = arr;
        }
    });    
}

/**
 * Called on program start
 */
function init() {
    bglog("init()");
	ang_history_scope = angular.element(document.getElementById("streamerListController")).scope();
    load_streamer_prefs();
    ang_history_scope.add_streamer_single("gobs", 1);
    // ang_history_scope.$apply();
    // bglog(ang_history_scope.streamers);
    chrome.runtime.onMessage.addListener(handle_comm_messages);
}

/**
 * Gets the currently online streamers and then 
 * calls online_arr_result_callback on the result
 */
function check_online_streams(online_arr_result_callback){
	chrome.runtime.sendMessage({
		"message" : "check_online_streams_msg",
		"streamer_array" : ang_history_scope.streamers
	},
    function(streamers){
        // bglog(streamers);
        online_arr_result_callback(streamers);
    });
}

/**
 * Handles all incoming communication messages meant 
 * for the options handler to perform.
 */
function handle_comm_messages(request, sender, sendResponse){
    var get_streamer_list = "get_streamer_list";
    if(request.message === get_streamer_list){
        // bglog(ang_history_scope.streamers);
        // bglog("got streamer list request");
        if(ang_history_scope === undefined){
        } else {
            sendResponse(ang_history_scope.streamers);
        }
    }
    return true;
}

/**
 * Called when chrome returns history.
 * Places all of the user"s watched twitch streams into an array,
 * and uses that array to populate the view preferences list.
 */
function history_callback(result) {
    bglog("history_callback(");
	if (result) {
		chrome.history.search({
			"text" : "https://www.twitch.tv*",
			"startTime" : 0,
			"endTime" : new Date().getTime()
		}, function (history_arr) {
			var potential_streamer_arr = [];
			//grab all twitch stream urls from history and add them to array
			for (var i = 0; i < history_arr.length; i++) {
				var url = history_arr[i].url;
                var regex = /^(https:\/\/www\.twitch\.tv\/\w+)$/g;
				//generate streamer array from urls
				if (url.match(regex)) {
					potential_streamer_arr.push({
                        "name" : url.split("v/")[1],
                        "visited_count" : history_arr[i].visitCount
                    });
				}
			}
			get_valid_streams(potential_streamer_arr);
		});
	} else {
		chrome.permissions.request({
			permissions : ["history"]
		}, function (granted) {
			if (granted) {
				history_callback(true);
				$("#gen-history-warning").text("");
			} else {
				$("#gen-history-warning").text("You must allow the app to view your browser history to generate streamer preferences.");
			}
		});
	}
}

/**
 * Sorts list of streamers
 */
function sort_streamer_array(streamer_array) {
	streamer_array.sort(function (a, b) {
		if (a.visited_count <= b.visited_count) return 1;
		if (a.visited_count > b.visited_count) return -1;
		return 0;
	});
}

/**
 * Determines which streams are valid from a list 
 * of potential usernames
 */
function get_valid_streams(potential_streamer_arr) {
    bglog("get_valid_streams(");
	bglog(potential_streamer_arr);
	chrome.runtime.sendMessage({
		"message" : "get_valid_streamers_msg",
		"potential_streamers" : potential_streamer_arr
	}, function (streamers) {
        sort_streamer_array(streamers)
        ang_history_scope.set_arr(streamers);
        save_streamer_prefs();
	});
}

/**
 * Passes streamer preference data to
 * background for saving
 */
function save_streamer_prefs() {
    bglog("savestart")
	chrome.runtime.sendMessage({
		"message" : "save_streamer_prefs_msg",
        "streamer_array" : ang_history_scope.streamers
	}, function (streamers) {
        bglog("You so save!");
	});
}

/**
 * Loads streamer preference data from
 * background and updates the angular controls 
 * based on the result.
 */
function load_streamer_prefs() {
	chrome.runtime.sendMessage({
		"message" : "load_streamer_prefs_msg"
	}, function (pref_obj) {
        // streamer_array = pref_obj.streamer_array;
        ang_history_scope.set_arr(pref_obj.streamer_array);
        ang_history_scope.$apply();
        // bglog("setting to");
        // bglog(pref_obj.streamer_array)
	});
}


/**
 * log to background instead of options script
 */
function bglog(str){
    chrome.runtime.sendMessage({
        "message" : "print_to_bg_msg", 
        "printconts" : str
    });
}