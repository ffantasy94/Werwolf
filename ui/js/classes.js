var WerWolf = WerWolf || {};

WerWolf.Game = function(tabName, title, click) {
	var thisref = this;
	this.tab = UI.CreateTab(tabName, title, click);
	this.content = UI.CreateLoadingIndicator();
	
	this.Attach = function() {
		thisref.tab.appendTo($(".tab-container"));
	};
	
	this.Activate = function() {
		$(".tab-button.active").removeClass("active");
		thisref.tab.addClass("active");
		var parent = thisref.tab.parent();
		thisref.tab.insertBefore(parent.children().eq(0));
		$(".main-content").children().remove();
		thisref.content.appendTo($(".main-content"));
	};
	
	this.Remove = function() {
		thisref.tab.remove();
		thisref.content.remove();
		for (var i = 0; i<Data.Games.length; ++i)
			if (Data.Games[i] == thisref) {
				Data.Games.splice(i, 1);
				break;
			}
	};
	
	Data.Games.push(this);
};

WerWolf.AddGame = function() {
	var thisref = this;
	WerWolf.Game.call(this, "+", Lang.Get("newTabName"), function() {
		thisref.Activate();
	});
	
	var activate = this.Activate;
	this.Activate = function() {
		if (Data.NewGameTab != null) return;
		var game = new WerWolf.NewGame();
		game.Attach();
		game.Activate();
	};
};
WerWolf.AddGame.prototype = Object.create(WerWolf.Game.prototype);

WerWolf.NewGame = function() {
	var thisref = this;
	WerWolf.Game.call(this, Lang.Get("newGameTabName"), 
		Lang.Get("newTabName"), function() {
			thisref.Activate();
		});
	Data.NewGameTab = this;
	this.content = UI.CreateNewGameBox(function(){
		var name = thisref.content.find(".newGroupName").val();
		if (name == "") {
			alert(Lang.Get("insertNameMessage"));
			return;
		}
		Logic.ApiAccess.CreateGroup(name, Data.UserId);
	}, function() {
		var key = thisref.content.find(".joinGroupKey").val();
		if (key == "") {
			alert(Lang.Get("insertKeyMessage"));
			return;
		}
		Logic.ApiAccess.AddUserToGroupByKey(Data.UserId, key);
	});
	var remove = this.Remove;
	this.Remove = function() {
		remove();
		Data.NewGameTab = null;
	};
};
WerWolf.NewGame.prototype = Object.create(WerWolf.Game.prototype);

WerWolf.RunningGame = function(id, data) {
	var thisref = this;
	WerWolf.Game.call(this, data.name, data.name, function(){
		thisref.Activate();
	});
	this.id = id;
	this.data = data;
	this.content = UI.CreateUserFrame();
	Data.CurrentGames[id] = this;
	
	this.LoopEvents = [];
	var intervall = setInterval(function(){
		if (thisref.LoopEvents.length > 0)
			Logic.ApiAccess.Multi(thisref.LoopEvents);
	}, 1000);
	
	var updateUserNames = function(data) {
		thisref.content.find(".user-entry.entry-"+data.user)
			.find(".user-name").text(data.name);
	};
	Logic.RequestEvents.getAccountName.add(updateUserNames);
	
	var remove = this.Remove;
	this.Remove = function() {
		clearInterval(intervall);
		Logic.RequestEvents.getAccountName.remove(updateUserNames);
		remove();
		Data.CurrentGames[id] = undefined;
	};
	
	this.userList = [];
	this.UpdateUser = function(user) {
		thisref.userList = user;
		thisref.content.find(".user-count").text(""+user.length);
		var container = thisref.content.find(".user-list");
		var request = [];
		for (var i = 0; i<user.length; ++i) {
			var entry = container.find(".entry-"+user[i]);
			if (entry.length == 0) {
				var roles = [];
				if (data.leader == user[i]) roles.push("leader");
				else roles.push("member");
				var name = Data.UserIdNameRef[user];
				entry = UI.CreateUserEntry(user[i], name, roles);
				entry.appendTo(container);
				if (name == undefined)
					request.push(JSON.stringify({
						mode: "getAccountName",
						user: user[i]
					}));
			}
		}
		if (request.length>0)
			Logic.ApiAccess.Multi(request);
		thisref.content.find(".user-frame .loading-frame").remove();
	};
};
WerWolf.RunningGame.prototype = Object.create(WerWolf.Game.prototype);

WerWolf.PrepairGame = function(id, data) {
	WerWolf.RunningGame.call(this, id, data);
	var thisref = this;
	//fallback
	if (data.currentGame != null) {
		thisref.Remove();
		return;
	}
	//normal
	this.LoopEvents.push(JSON.stringify({
		mode: "getUserFromGroup",
		group: this.id
	}));
	
	this.UpdateGroupInfo = function(data) {
		if (data.currentGame != null) {
			thisref.Remove();
			var game = new WerWolf.PlayGame(data.id, data);
			game.Attach();
			game.Activate();
		}
	};
	
	this.UpdateGameData = function(game) {
		//Do nothing
	};
	
	var frame = this.content.find(".game-frame");
	frame.children().remove();
	if (data.leader == Data.UserId) {
		frame.append(UI.CreateGamePreSettings(data.name, 
			data.enterKey, userList.length, function() {
				var roles = [];
				var inputs = thisref.content.find(".role-ammount");
				for (var i = 0; i<inputs.length; ++i) {
					var val = inputs.eq(i).val()*1;
					var key = inputs.eq(i).attr("data-role");
					if (key == 'storytel') continue; //implicit given
					for (var n = 0; n<val; ++n)
						roles.push(key);
				}
				Logic.ApiAccess.CreateGame(id, roles);
				thisref.Remove();
				var game = new WerWolf.PlayGame(data.id, data);
				game.Attach();
				game.Activate();
			}));
	}
	else {
		frame.append(UI.CreateMemberWaitScreen());
		this.LoopEvents.push(JSON.stringify({
			mode: "getGroup",
			group: this.id
		}));
	}
};
WerWolf.PrepairGame.prototype = Object.create(WerWolf.RunningGame.prototype);

WerWolf.PlayGame = function(id, data) {
	var thisref = this;
	WerWolf.RunningGame.call(this, id, data);
	//fallback
	if (data.currentGame == null) {
		thisref.Remove();
		return;
	}
	//normal
	Data.RunningGames[data.currentGame.id] = this;
	this.LoopEvents.push(JSON.stringify({
		mode: "getGame",
		game: data.currentGame.id
	}));
	
	Logic.ApiAccess.Multi([JSON.stringify({
		mode: "getUserFromGroup",
		group: this.id
	}),JSON.stringify({
		mode: "getPlayer",
		game: data.currentGame.id,
		user: Data.UserId
	}),JSON.stringify({
		mode: "getAccessibleChatRooms",
		game: data.currentGame.id,
		user: Data.UserId
	})]);
	
	var lastPhase = null;
	this.UpdateGameData = function(game) {
		if (lastPhase == null) {
			
		}
	};
	
	var playerList = {};
	this.UpdatePlayer = function(player) {
		playerList[player.user] = player;
		var elem = this.content.find(".user-entry.entry-"+player.user)
			.find(".user-roles");
		for (var i = 0; i<player.roles.length; ++i) {
			var key = player.roles[i].roleKey;
			if (elem.find(".role-"+key).length == 0) {
				UI.CreateRole(key).appendTo(elem);
			}
		}
	};
	
	var rooms = {};
	this.UpdateRoom = function(room) {
		var cont = thisref.content.find(".h-container-i");
		for (var key in room) {
			if (!room.hasOwnProperty(key)) continue;
			if (rooms[key] == undefined) {
				rooms[key] = {
					id: key,
					access: room[key],
					box: UI.CreateChatBox(
						room[key].chatmode, key).appendTo(cont)
				};
				if (!room[key].enableWrite)
					rooms[key].box.addClass("readonly");
				Data.ChatRoomGames[key] = thisref;
				thisref.LoopEvents.push(JSON.stringify({
					mode: "getChatRoom",
					chat: key
				}));
			}
		}
	};
	this.UpdateRoomData = function(room) {
		//console.log(room);
		var old = rooms[room.id].data;
		rooms[room.id].data = room;
		if (room.opened) rooms[room.id].box.addClass("open");
		else rooms[room.id].box.removeClass("open");
		if (room.voting != old.voting) {
			
		}
	};
	
	var frame = this.content.find(".game-frame");
	frame.children().remove();
	frame.append(UI.CreateChatBoxContainer());
	
	var remove = this.Remove;
	this.Remove = function() {
		remove();
		Data.RunningGames[data.currentGame.id] = undefined;
	};
};
WerWolf.PlayGame.prototype = Object.create(WerWolf.RunningGame.prototype);


