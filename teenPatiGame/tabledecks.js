var _ = require("underscore");
var utils = require("./utils");
var deck = require("./deck");
var cardComparer = require("./cardCompar");
const axios = require("axios");
require("dotenv").config();
const BASEURL = "https://dev-api.sikkaplay.com/api/v1/user/update";
function Table(boot, privateTableKey) {
  this.gid = privateTableKey || utils.guid();
  this.gameStarted = false;
  var maxPlayers = 7;
  var players = {};
  var clients = {};
  var tableInfo;
  var cardsInfo = {};
  // defining the avilable slots and initialy all are the slots are empty
  var avialbleSlots = {
    slot1: "slot1",
    slot2: "slot2",
    slot3: "slot3",
    slot4: "slot4",
    slot5: "slot5",
    slot6: "slot6",
    slot7: "slot7",
  };
  // this function reseting the table for restarting the game
  this.resetTable = function () {
    var iBoot = boot || 2;
    tableInfo = {
      boot: iBoot,
      lastBet: iBoot,
      lastBlind: true,
      maxBet: iBoot * Math.pow(2, 7),
      potLimit: iBoot * Math.pow(2, 11),
      showAmount: true,
    };
  };
  // this function returns all the players in current game table/room
  this.getPlayers = function () {
    return players;
  };
  // this function returns number of total joined player in the table/room
  this.getPlayersCount = function () {
    return _.size(players);
  };
  // this function  retruns the table details
  this.getTableInfo = function () {
    tableInfo.isShowAvailable = this.getActivePlayers() === 2;
    tableInfo["activePlayer"] = this.getActivePlayers();
    return tableInfo;
  };
  // this function checks that potlimit is Exceeded or not
  this.isPotLimitExceeded = function () {
    if (tableInfo.amount) {
      return tableInfo.amount > tableInfo.potLimit;
    }
    return false;
  };

  this.countBlind = function (id) {
    if (id && players[id] && players[id].playerInfo.isAI === true) {
      let player = players[id];
      return player.blindCount >= 3;
    }
    return false;
  };
  // this function checks that chalLimit is Exceeded or not
  this.isChalLimitExceeded = function () {
    if (tableInfo.lastBet) {
      return tableInfo.lastBet > tableInfo.maxBet;
    }
    return false;
  };
  //  this function add a new palyers in avalable table
  this.addPlayer = function (player, client) {
    if (this.getActivePlayers() <= maxPlayers) {
      for (var slot in avialbleSlots) {
        player.slot = slot;
      }
      players[player.id] = player;
      clients[player.id] = client;
      players[player.id].active = !this.gameStarted;
      delete avialbleSlots[player.slot];
      return player;
    }
    return false;
  };
  // this function removes a player
  this.removePlayer = function (id) {
    if (id && players[id]) {
      var player = players[id];
      avialbleSlots[player.slot] = player.slot;
      delete cardsInfo[id];
      delete players[id];
      delete clients[id];
      return player;
    }
  };
  // this function is used to get a player by slot
  this.getPlayerBySlot = function (slot) {
    for (var player in players) {
      if (players[player].slot === slot) {
        return players[player];
      }
    }
    return undefined;
  };
  // this function return the last or previous player
  this.getPrevActivePlayer = function (id) {
    var slot = players[id].slot,
      num = slot.substr(4) * 1;
    for (var count = 0; count <= 6; count++) {
      num--;
      if (num === 0) {
        num = 7;
      }
      if (avialbleSlots["slot" + num]) {
        continue;
      }
      if (this.getPlayerBySlot("slot" + num)) {
        if (
          !this.getPlayerBySlot("slot" + num).active ||
          this.getPlayerBySlot("slot" + num).packed
        ) {
          continue;
        } else {
          break;
        }
      }
    }
    var newPlayer = this.getPlayerBySlot("slot" + num);
    return newPlayer;
  };
  // this function returns the next player
  this.getNextActivePlayer = function (id) {
    var slot = players[id].slot;
    // finding the digit of the slot.
    var num = slot.substr(4) * 1;
    for (var count = 0; count <= 6; count++) {
      num++;
      if (num > 7) {
        num = num % 7;
      }
      if (avialbleSlots["slot" + num]) {
        continue;
      }
      if (this.getPlayerBySlot("slot" + num)) {
        if (
          !this.getPlayerBySlot("slot" + num).active ||
          this.getPlayerBySlot("slot" + num).packed
        ) {
          continue;
        } else {
          break;
        }
      }
    }
    var newPlayer = this.getPlayerBySlot("slot" + num);
    return newPlayer;
  };
  // this function returns turn for the next player
  this.getNextSlotForTurn = function (id) {
    players[id].turn = false;
    var newPlayer = this.getNextActivePlayer(id);
    newPlayer.turn = true;
  };
  // this function is used to check the player is active or not
  this.isActivePlayer = function (id) {
    return players[id] && players[id].active;
  };
  // this function is used to pack a player
  this.packPlayer = function (id) {
    players[id].packed = true;
    players[id].playerInfo.gamesLost += 1;
    players[id].playerInfo.totalGamesPlayed += 1;
    const payload = {
      gamesLost: players[id].playerInfo.gamesLost,
      totalGamesPlayed: players[id].playerInfo.totalGamesPlayed,
    };
    console.log("packed ** paload", payload);
    axios
      .put("https://dev-api.sikkaplay.com/api/v1/user/update", payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${players[id].playerInfo.token}`,
        },
      })
      .then(function (response) {
        console.log("place packed data ***171", response.data);
      })
      .catch(function (error) {
        console.log("erroor in packed place 174 ***", error.message);
      });
    // console.log("packed palyer ************** 158", players[id]);
    this.getNextSlotForTurn(id);
    return this.getPlayers();
  };
  // this function is used for making the bet
  this.placeBetOnly = function (id, bet, blind) {
    tableInfo.amount += bet;
    tableInfo.lastBet = bet;
    players[id].lastBet = bet;
    players[id].playerInfo.chips -= bet;

    if (
      this.getActivePlayers() === 2 &&
      id &&
      players[id].playerInfo.isAI === true &&
      blind === true
    ) {
      players[id].blindCount += 1;
    } else if (id && blind === true && players[id].playerInfo.isAI === false) {
      players[id].blindCount += 1;
    }

    console.log(
      "pcaced Bet      by player*******88888***********************************************",
      players[id]
    );
    // collecting convence fees initially  fees=0;
    // 0.2 percent
    players[id].playerInfo.fees += (bet * 2) / 1000;

    const payload = { wallet: players[id].playerInfo.chips };
    axios
      .put("https://dev-api.sikkaplay.com/api/v1/user/update", payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${players[id].playerInfo.token}`,
        },
      })
      .then(function (response) {
        console.log("place Bet only ***198", response.data);
      })
      .catch(function (error) {
        console.log("erroor in bet place 200 ***", error.message);
      });
    tableInfo.lastBlind = blind;
  };
  this.placeBet = function (id, bet, blind) {
    this.placeBetOnly(id, bet, blind);
    this.getNextSlotForTurn(id);
    return this.getPlayers();
  };
  // this function is used to find current turn for a player
  this.getActionTurnPlayer = function () {
    var activePlayer;
    for (var player in players) {
      if (players[player].turn) {
        activePlayer = players[player];
        break;
      }
    }
    return activePlayer;
  };
  // this function is used to reset the sideshow for all players at start of the game
  this.resetSideShowTurn = function () {
    for (var player in players) {
      players[player].sideShowTurn = false;
    }
  };
  // this function is used to deny the sideshow request
  this.sideShowDenied = function (id) {
    players[id].lastAction = "Denied";
    return [players[id].playerInfo.userName, " has denied the request"].join(
      ""
    );
  };
  // this function is used to accept the shide show request
  this.sideShowAccepted = function (id) {
    players[id].lastAction = "Accepted";
    var nextPlayer = this.getNextActivePlayer(id);
    var cardsToCompare = [
      {
        id: id,
        set: cardsInfo[id].cards,
      },
      {
        id: nextPlayer.id,
        set: cardsInfo[nextPlayer.id].cards,
      },
    ];
    var result = cardComparer.getGreatest(cardsToCompare),
      cardsToShow = {};
    cardsToShow[id] = {
      cardSet: cardsInfo[id].cards,
    };
    cardsToShow[nextPlayer.id] = {
      cardSet: cardsInfo[nextPlayer.id].cards,
    };
    if (result.id === id) {
      nextPlayer.packed = true;
    } else {
      players[id].packed = true;
    }
    return {
      message: [
        players[result.id].playerInfo.userName,
        " has won the side show",
      ].join(""),
      cardsToShow: cardsToShow,
    };
  };
  // this function is used to make turn for a player
  this.setNextPlayerTurn = function () {
    var activeTurnPlayer = this.getActionTurnPlayer();
    this.getNextSlotForTurn(activeTurnPlayer.id);
  };
  // this function is used to make side show request
  this.placeSideShow = function (id, bet, blind) {
    this.placeBetOnly(id, bet, blind);
    var message = this.setPlayerForSideShow(id);
    return message;
  };
  // this function is used to set side show option available or not
  this.setPlayerForSideShow = function (id) {
    var prevPlayer = this.getPrevActivePlayer(id);
    prevPlayer.sideShowTurn = true;
    return [players[id].playerInfo.userName, " asking for side show"].join("");
  };
  // this function is used to stop the game
  this.stopGame = function () {
    this.gameStarted = false;
    tableInfo.gameStarted = false;
  };
  // this function is used to collect the bootamount for each players
  this.collectBootAmount = function () {
    var bootAmount = 0;
    for (var player in players) {
      if (players[player].active) {
        players[player].lastBet = tableInfo.boot;
        players[player].lastAction = "";
        bootAmount = bootAmount + tableInfo.boot;
        players[player].playerInfo.chips -= tableInfo.boot;
        // collecting the convence fees of 0.2 percent
        players[player].playerInfo.fees += (tableInfo.boot * 2) / 1000;

        const payload = { wallet: players[player].playerInfo.chips };
        console.log("base url", BASEURL);
        axios
          .put("https://dev-api.sikkaplay.com/api/v1/user/update", payload, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${players[player].playerInfo.token}`,
            },
          })
          .then(function (response) {
            console.log("collecting boot amount", response.data);
          })
          .catch(function (error) {
            console.log("error in collectin boot 306 ****", error.message);
          });
      }
    }

    tableInfo.amount = bootAmount;
  };
  // this function return the cards
  this.getCardInfo = function () {
    return cardsInfo;
  };
  // this function is used to update the side show request
  this.updateSideShow = function (id) {
    var nextPlayer = this.getNextActivePlayer(id);
    if (nextPlayer) {
      nextPlayer.isSideShowAvailable = true;
    }
  };

  function distributeCards() {
    deck.shuffle();

    var deckCards = deck.getCards();
    // console.log("current dec",deckCards);
    index = 0;
    for (var i = 0; i < 3; i++) {
      for (var player in players) {
        if (players[player].active) {
          if (!cardsInfo[players[player].id]) {
            cardsInfo[players[player].id] = {};
          }
          if (!cardsInfo[players[player].id].cards) {
            cardsInfo[players[player].id].cards = [];
          }
          cardsInfo[players[player].id].cards.push(deckCards[index++]);
        }
      }
    }
  }

  this.getActivePlayers = function () {
    var count = 0;
    for (var player in players) {
      if (players[player].active && !players[player].packed) {
        count++;
      }
    }
    return count;
  };
  this.resetAllPlayers = function () {
    for (var player in players) {
      delete players[player].winner;
      players[player].turn = false;
      players[player].active = true;
      players[player].packed = false;
      players[player].seen = false;
      players[player].blindCount = 0;
      players[player].isSideShowAvailable = false;
      players[player].cardSet = {
        closed: true,
      };
      players[player].lastBet = "";
      players[player].lastAction = "";
    }
  };
  this.decideWinner = function (showCards) {
    var cardSets = [],
      winnerCard,
      msg = "";
    for (var player in players) {
      console.log("players data in winner  374**********", players[player]);
      players[player].turn = false;
      if (players[player].active && !players[player].packed) {
        if (showCards) {
          players[player].cardSet.cards = cardsInfo[players[player].id].cards;
          players[player].cardSet.closed = false;
        }
        cardSets.push({
          id: players[player].id,
          set: cardsInfo[players[player].id].cards,
        });
      }
    }

    if (cardSets.length === 1) {
      winnerObj = players[cardSets[0].id];
    } else {
      winnerCard = cardComparer.getGreatest(cardSets);
      winnerObj = players[winnerCard.id];
    }
    winnerObj.winner = true;
    winnerObj.playerInfo.chips =
      winnerObj.playerInfo.chips + (tableInfo.amount * 90) / 100;
    winnerObj.playerInfo.totalGamesPlayed += 1;
    winnerObj.playerInfo.gamesWon += 1;
    const payload = {
      wallet: winnerObj.playerInfo.chips,
      totalGamesPlayed: winnerObj.playerInfo.totalGamesPlayed,
      gamesWon: winnerObj.playerInfo.gamesWon,
    };
    axios
      .put("https://dev-api.sikkaplay.com/api/v1/user/update", payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${winnerObj.playerInfo.token}`,
        },
      })
      .then(function (response) {
        console.log("winnner wallet update 412 ***", response.data);
      })
      .catch(function (error) {
        console.log(
          "errror in while updating winner wining ***415",
          error.message
        );
      });

    for (var player in players) {
      players[player].turn = false;
      if (
        players[player].active &&
        !players[player].packed &&
        !players[player]["winner"]
      ) {
        console.log(
          "players data after winner decided winner   *****",
          players[player]
        );
        players[player].playerInfo.totalGamesPlayed += 1;
        players[player].playerInfo.gamesLost += 1;
        const payload = {
          gamesLost: players[player].playerInfo.gamesLost,
          totalGamesPlayed: players[player].playerInfo.totalGamesPlayed,
        };
        axios
          .put("https://dev-api.sikkaplay.com/api/v1/user/update", payload, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${players[player].playerInfo.token}`,
            },
          })
          .then(function (response) {
            console.log("lost  wallet update 436 ***", response.data);
          })
          .catch(function (error) {
            console.log(
              "errror in lost during diciding winner ***439",
              error.message
            );
          });
      }
    }

    if (winnerCard) {
      return [
        winnerObj.playerInfo.userName,
        " won with ",
        winnerCard.typeName,
      ].join("");
    }
    return undefined;
  };
  this.reset = function () {
    cardsInfo = {};
    this.resetTable();
    this.resetAllPlayers();
  };
  this.chat = function (id, msg) {
    let players = this.getPlayers();
    let player = players[id];
    return { msg: msg, player: player };
  };
  this.decideDeal = function () {
    var firstPlayer = null,
      dealFound = false,
      isFirst = true,
      dealPlayer;
    for (var player in players) {
      if (players[player].active) {
        if (isFirst) {
          firstPlayer = players[player];
          isFirst = false;
        }
        if (players[player].deal === true) {
          players[player].deal = false;
          dealPlayer = players[player];
          dealFound = true;
        }
      }
    }
    if (!dealFound) {
      firstPlayer.deal = true;
    } else {
      var nextPlayer = this.getNextActivePlayer(dealPlayer.id);
      nextPlayer.deal = true;
    }
  };
  this.decideTurn = function () {
    var firstPlayer = null,
      dealFound = false,
      isFirst = true,
      dealPlayer;
    for (var player in players) {
      if (players[player].active) {
        if (isFirst) {
          firstPlayer = players[player];
          isFirst = false;
        }
        if (players[player].deal === true) {
          dealPlayer = players[player];
          dealFound = true;
        }
      }
    }
    if (!dealFound) {
      firstPlayer.turn = true;
    } else {
      var nextPlayer = this.getNextActivePlayer(dealPlayer.id);
      nextPlayer.turn = true;
    }
  };
  this.startGame = function () {
    cardsInfo = {};
    this.resetTable();
    this.resetAllPlayers();
    this.gameStarted = true;
    tableInfo.gameStarted = true;
    this.decideDeal();
    this.decideTurn();
    tableInfo.isShowAvailable = this.getActivePlayers() === 2;
    tableInfo.isSideShowAvailable = false;
    this.collectBootAmount();
    distributeCards();
  };
  this.resetTable();
  return this;
}
function TableManager() {
  return {
    listOfTable: [],
    createNewTable: function (boot, privateKey) {
      var table = new Table(boot, privateKey);
      this.listOfTable.push(table);
      return table;
    },

    getTable: function (guid) {
      var result = _.where(this.listOfTable, {
        gid: guid,
      });
      if (result.length !== 0) {
        return result[0];
      }
      return null;
    },
    getNotFullTable() {
      for (const table of this.listOfTable) {
        const contPlayer = table.getPlayersCount();
        if (contPlayer < 7) {
          return table;
        }
      }
      return null;
    },
    deleteTable: function (guid) {
      // Use the filter method to create a new array without the table to delete
      this.listOfTable = this.listOfTable.filter(function (table) {
        return table.gid !== guid;
      });
    },
    getAllTables: function () {
      return this.listOfTable;
    },
    getTableByBoot: function (boot) {},

    startCountDown: function (secs) {},

    startGame: function () {},
  };
}

module.exports = new TableManager();
