const http = require("http");
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const socketIo = require("socket.io");
require("dotenv").config();
var tables = require("./teenPatiGame/tabledecks");
const {
  joinTable,
  newPlayerJoined,
  connectionSuccess,
  seeMyCards,
  cardsSeen,
  placePack,
  showWinner,
  playerPacked,
  notification,
  startNew,
  resetTable,
  gameCountDown,
  placeBet,
  betPlaced,
  respondSideShow,
  sideShowResponded,
  sideShowPlaced,
  disconnect,
  playerLeft,
  placeSideShow,
  chat,
  recieve,
  tablesList,
  deleteTable,
  tableFull,
  getAllTable,
} = require("./teenPatiGame/action");
const app = express();

app.use(cors());

app.get("/health", (req, res) => {
  res.status(200).json({
    health: "RUNNING",
  });
});
const server = http.createServer(app);
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log("a user is connected");
  socket.on("private", (data) => {
    console.log("table data is comming from frontend  for the private table*****************88888888888888888",data)
    init(socket, data.boot, data.key);
  });
  socket.on("public", () => {
    init(socket);
  });

  socket.on("turnament", (data) => {
    startTurnament(socket, data.boot, data.key);
  });
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`server is working on ${port}`);
});

function init(socket, boot, privateKey) {
  console.log("Socket is conneted here");
  let table;
  if (privateKey) {
    table = tables.getTable(privateKey);
    if (!table) {
      table = tables.createNewTable(boot, privateKey);
      console.log("new private table", table);
    } else {
      console.log("existed table", table);
      let playerCount = table.getPlayersCount();
      if (playerCount >= 7) {
        socket.emit(tableFull, {
          msg: "Sorry! table  full",
        });
      }
    }
  } else {
    table = tables.getNotFullTable();
    if (!table) {
      table = tables.createNewTable();
      let args = {
        displayName: "Prakash",
        userName: "Prakash",
        chips: 2499000,
        guid: table.gid,
        _id: "651139bba59b7dda98f41b43",
        fees: 0,
        avatar:
          "https://s3.us-east-2.amazonaws.com/sikkaplay.com-assets/assets/Avtar/Group 1000006658.svg",
        isAdmin: false,
        id: "651139bba59b7dda98f41b43",
        isAI: true,
        gamesLost: 0,
        gamesWon: 0,
        totalGamesPlayed: 0,
      };
      table.addPlayer(
        {
          id: args.id,
          cardSet: {
            closed: true,
          },
          playerInfo: args,
          seen: false,
          blindCount: 0,
        },
        args.id
      );
      console.log("a new  table is created :", table);
    } else {
      console.log("existing table", tables.listOfTable);
    }
  }
  const room = table.gid;
  socket.on("joinTable", (args) => {
    console.log("it is comming from fronted", args);
    socket.join(room);
    var addedPlayer = table.addPlayer(
      {
        id: socket.id,
        cardSet: {
          closed: true,
        },
        playerInfo: args,
        seen: false,
        blindCount: 0,
      },
      socket
    );
    console.log("now players count:" + table.getActivePlayers());
    console.log("Now players List :" + table.getPlayers());
    if (addedPlayer !== false) {
      var newPlayer = {
        id: socket.id,
        tableId: table.gid,
        slot: addedPlayer.slot,
        active: addedPlayer.active,
        packed: addedPlayer.packed,
        playerInfo: args,
        cardSet: addedPlayer.cardSet,
        otherPlayers: table.getPlayers(),
        blindCount: 0,
        seen: false,
      };
      socket.emit(joinTable, newPlayer);
      socket.broadcast.to(room).emit(newPlayerJoined, newPlayer);
      startNewGameOnPlayerJoin();
    }
  });
  socket.emit(connectionSuccess, {
    id: socket.id,
    tableId: table.gid,
  });

  socket.on(seeMyCards, function (args) {
    var cardsInfo = table.getCardInfo()[args.id].cards;
    table.updateSideShow(args.id);
    let getplayer = table.getPlayers();
    getplayer[args.id].seen = true;
    socket.emit(cardsSeen, {
      cardsInfo: cardsInfo,
      players: getplayer,
    });
    socket.broadcast.to(room).emit("playerCardSeen", {
      id: args.id,
      players: getplayer,
    });
  });

  socket.on(placePack, function (args) {
    var players = table.packPlayer(args.player.id);
    if (table.getActivePlayers() === 1) {
      table.decideWinner();
      socket.emit("showWinner", {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        packed: true,
      });
      socket.broadcast.to(room).emit(showWinner, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        packed: true,
      });
      table.stopGame();
      startNewGame();
    } else {
      socket.emit(playerPacked, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
      socket.broadcast.to(room).emit(playerPacked, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
    }
  });

  function startNewGameOnPlayerJoin() {
    if (table.getPlayersCount() >= 2 && !table.gameStarted) {
      setTimeout(function () {
        socket.emit("gameCountDown", {
          counter: 7,
        });
        socket.broadcast.to(room).emit("gameCountDown", {
          counter: 7,
        });
      }, 1000);
      setTimeout(function () {
        if (table.getPlayersCount() >= 2 && !table.gameStarted) {
          table.startGame();
          var sentObj = {
            players: table.getPlayers(),
            table: table.getTableInfo(),
          };
          socket.emit(startNew, sentObj);
          socket.broadcast.to(room).emit(startNew, sentObj);
        } else if (table.getPlayersCount() == 1 && !table.gameStarted) {
          socket.emit(notification, {
            message: "Please wait for more players to join",
            timeout: 4000,
          });
          socket.broadcast.to(room).emit(notification, {
            message: "Please wait for more players to join",
            timeout: 4000,
          });
        }
      }, 9000);
    } else if (table.getPlayersCount() == 1 && !table.gameStarted) {
      socket.emit(notification, {
        message: "Please wait for more players to join",
        timeout: 4000,
      });
      socket.broadcast.to(room).emit(notification, {
        message: "Please wait for more players to join",
        timeout: 4000,
      });
    }
  }

  function startNewGame(after) {
    if (table.getPlayersCount() >= 2 && !table.gameStarted) {
      setTimeout(function () {
        socket.emit(gameCountDown, {
          counter: 9,
        });
        socket.broadcast.to(room).emit(gameCountDown, {
          counter: 9,
        });
      }, after || 6000);
      setTimeout(function () {
        if (table.getPlayersCount() >= 2 && !table.gameStarted) {
          table.startGame();
          var sentObj = {
            players: table.getPlayers(),
            table: table.getTableInfo(),
          };
          socket.emit(startNew, sentObj);
          socket.broadcast.to(room).emit(startNew, sentObj);
        } else if (table.getPlayersCount() == 1) {
          socket.emit(notification, {
            message: "Please wait for more players to join",
            timeout: 4000,
          });
          socket.broadcast.to(room).emit(notification, {
            message: "Please wait for more players to join",
            timeout: 4000,
          });
          // setTimeout(function() {
          table.reset();
          var sentObj = {
            players: table.getPlayers(),
            table: table.getTableInfo(),
          };
          socket.emit(resetTable, sentObj);
          socket.broadcast.to(room).emit(resetTable, sentObj);
          // }, 7000);
        }
      }, 13000);
    } else if (table.getPlayersCount() == 1) {
      setTimeout(function () {
        socket.emit(notification, {
          message: "Please wait for more players to join",
          timeout: 4000,
        });
        socket.broadcast.to(room).emit(notification, {
          message: "Please wait for more players to join",
          timeout: 4000,
        });
      }, 4000);
      setTimeout(function () {
        table.reset();
        var sentObj = {
          players: table.getPlayers(),
          table: table.getTableInfo(),
        };
        socket.emit(resetTable, sentObj);
        socket.broadcast.to(room).emit(resetTable, sentObj);
      }, 4000);
    }
  }

  socket.on(placeBet, function (args) {
    var players = table.placeBet(
      args.player.id,
      args.bet.amount,
      args.bet.blind,
      args.player.playerInfo._id
    );
    if (
      args.bet.show ||
      table.isPotLimitExceeded() ||
      table.countBlind(args.player.id)
    ) {
      args.bet.show = true;
      var msg = table.decideWinner(args.bet.show);
      socket.emit(showWinner, {
        message: msg,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        potLimitExceeded: table.isPotLimitExceeded(),
      });
      socket.broadcast.to(room).emit(showWinner, {
        message: msg,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        potLimitExceeded: table.isPotLimitExceeded(),
      });
      table.stopGame();
      startNewGame();
    } else {
      socket.emit(betPlaced, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
      socket.broadcast.to(room).emit(betPlaced, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
    }
  });

  socket.on(respondSideShow, function (args) {
    var players = table.getPlayers(),
      msg = "";
    table.resetSideShowTurn();
    if (args.lastAction === "Denied") {
      table.setNextPlayerTurn();
      table.sideShowDenied(args.player.id);
      msg = [args.player.playerInfo.userName, " has denied side show"].join("");
      socket.emit(sideShowResponded, {
        message: msg,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
      socket.broadcast.to(room).emit(sideShowResponded, {
        message: msg,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
    } else if (args.lastAction === "Accepted") {
      table.setNextPlayerTurn();
      msg = table.sideShowAccepted(args.player.id);
      socket.emit(sideShowResponded, {
        message: msg.message,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
      socket.broadcast.to(room).emit(sideShowResponded, {
        message: msg.message,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
    }
  });
  socket.on(placeSideShow, function (args) {
    var sideShowMessage = table.placeSideShow(
      args.player.id,
      args.bet.amount,
      args.bet.blind,
      args.player.playerInfo._id
    );
    var players = table.getPlayers();
    if (table.isPotLimitExceeded()) {
      args.bet.show = true;
      var msg = table.decideWinner(args.bet.show);
      socket.emit(showWinner, {
        message: msg,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        potLimitExceeded: table.isPotLimitExceeded(),
      });
      socket.broadcast.to(room).emit("showWinner", {
        message: msg,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        potLimitExceeded: table.isPotLimitExceeded(),
      });
      table.stopGame();
      startNewGame();
    } else {
      socket.emit(sideShowPlaced, {
        message: sideShowMessage,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
      socket.broadcast.to(room).emit(sideShowPlaced, {
        message: sideShowMessage,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
    }
  });

  socket.on(chat, function (args) {
    let chatMessage = table.chat(args.id, args.msg);
    socket.emit(recieve, chatMessage);
    socket.broadcast.to(room).emit(recieve, chatMessage);
  });

  //    socket.on(getAllTable,()=>{
  //     socket.emit(tablesList,{
  //         tables:tables.getAllTables()
  //     })
  //    })

  socket.on(deleteTable, (args) => {
    let tables = tables.deleteTable(args.guid);
    socket.emit(tablesList, {
      tables: tables,
    });
  });
  // here a player is leaving the game
  socket.on(disconnect, function () {
    if (table.gameStarted && table.isActivePlayer(socket.id)) {
      table.packPlayer(socket.id);
    }
    var removedPlayer = table.removePlayer(socket.id);
    console.log("disconnect for " + socket.id);
    console.log("total players left:" + table.getActivePlayers());
    socket.broadcast.to(room).emit(playerLeft, {
      bet: {
        lastAction: "Packed",
        lastBet: "",
      },
      removedPlayer: removedPlayer,
      placedBy: removedPlayer?.id,
      players: table.getPlayers(),
      table: table.getTableInfo(),
    });
    if (table.getActivePlayers() == 1 && table.gameStarted) {
      table.decideWinner();
      socket.emit(showWinner, {
        bet: {
          lastAction: "Packed",
          lastBet: "",
        },
        placedBy: removedPlayer?.id,
        players: table.getPlayers(),
        table: table.getTableInfo(),
        packed: true,
      });
      socket.broadcast.to(room).emit(showWinner, {
        bet: {
          lastAction: "Packed",
          lastBet: "",
        },
        placedBy: removedPlayer?.id,
        players: table.getPlayers(),
        table: table.getTableInfo(),
        packed: true,
      });
      table.stopGame();
      startNewGame();
    }
  });
  //    socket.on(disconnect,()=>{
  //        console.log("disconected");
  //    })
  socket.on("left", function () {
    if (table.gameStarted && table.isActivePlayer(socket.id)) {
      table.packPlayer(socket.id);
    }
    var removedPlayer = table.removePlayer(socket.id);
    console.log("disconnect for " + socket.id);
    console.log("total players left:" + table.getActivePlayers());
    socket.broadcast.to(room).emit(playerLeft, {
      bet: {
        lastAction: "Packed",
        lastBet: "",
      },
      removedPlayer: removedPlayer,
      placedBy: removedPlayer?.id,
      players: table.getPlayers(),
      table: table.getTableInfo(),
    });
    if (table.getActivePlayers() == 1 && table.gameStarted) {
      table.decideWinner();
      socket.emit(showWinner, {
        bet: {
          lastAction: "Packed",
          lastBet: "",
        },
        placedBy: removedPlayer?.id,
        players: table.getPlayers(),
        table: table.getTableInfo(),
        packed: true,
      });
      socket.broadcast.to(room).emit(showWinner, {
        bet: {
          lastAction: "Packed",
          lastBet: "",
        },
        placedBy: removedPlayer?.id,
        players: table.getPlayers(),
        table: table.getTableInfo(),
        packed: true,
      });
      table.stopGame();
      startNewGame();
    }
  });

  socket.on("kickOut", function (args) {
    if (table.gameStarted && table.isActivePlayer(args.id)) {
      table.packPlayer(args.id);
    }
    let players = table.getPlayers();
    let removedplayer = players[args.id];
    removedplayer["kickout"] = true;
    socket.to(args.id).emit("playerKickOut", {
      bet: {
        lastAction: "Kick Out",
        lastBet: "",
      },
      players: players,
      table: table.getTableInfo(),
      removedplayer: removedplayer,
    });
    socket.broadcast.to(room).emit("playerKickOut", {
      bet: {
        lastAction: "Kick Out",
        lastBet: "",
      },
      players: players,
      table: table.getTableInfo(),
      removedplayer: removedplayer,
    });
  });
}

function startTurnament(socket, boot, privateKey) {
  console.log("Socket is conneted here");
  let table;
  table = tables.getTable(privateKey);
  if (!table) {
    table = tables.createNewTable(boot, privateKey);
    console.log("new private table", table);
  } else {
    console.log("existed table", table);
    let playerCount = table.getPlayersCount();
    if (playerCount >= 7) {
      socket.emit(tableFull, {
        msg: "Sorry! table  full",
      });
    }
  }

  const room = table.gid;
  socket.on(joinTable, (args) => {
    //    console.log("it is comming from fronted", args);
    socket.join(room);
    var addedPlayer = table.addPlayer(
      {
        id: socket.id,
        cardSet: {
          closed: true,
        },
        playerInfo: args,
        seen: false,
      },
      socket
    );
    console.log("now players count:" + table.getActivePlayers());
    console.log("Now players List :" + table.getPlayers());
    if (addedPlayer !== false) {
      var newPlayer = {
        id: socket.id,
        tableId: table.gid,
        slot: addedPlayer.slot,
        active: addedPlayer.active,
        packed: addedPlayer.packed,
        playerInfo: args,
        cardSet: addedPlayer.cardSet,
        otherPlayers: table.getPlayers(),
        seen: false,
      };
      socket.emit(joinTable, newPlayer);
      socket.broadcast.to(room).emit(newPlayerJoined, newPlayer);
      startNewGameOnPlayerJoin();
    }
  });
  socket.emit(connectionSuccess, {
    id: socket.id,
    tableId: table.gid,
  });

  socket.on(seeMyCards, function (args) {
    var cardsInfo = table.getCardInfo()[args.id].cards;
    table.updateSideShow(args.id);
    let getplayer = table.getPlayers();
    getplayer[args.id].seen = true;
    socket.emit(cardsSeen, {
      cardsInfo: cardsInfo,
      players: getplayer,
    });
    socket.broadcast.to(room).emit(playerCardSeen, {
      id: args.id,
      players: getplayer,
    });
  });

  socket.on(placePack, function (args) {
    var players = table.packPlayer(args.player.id);
    if (table.getActivePlayers() === 1) {
      table.decideWinner();
      socket.emit(showWinner, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        packed: true,
      });
      socket.broadcast.to(room).emit(showWinner, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        packed: true,
      });
      table.stopGame();
      // startNewGame();
    } else {
      socket.emit(playerPacked, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
      socket.broadcast.to(room).emit(playerPacked, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
    }
  });

  function startNewGameOnPlayerJoin() {
    setTimeout(function () {
      socket.emit(gameCountDown, {
        counter: 118,
      });
      socket.broadcast.to(room).emit(gameCountDown, {
        counter: 118,
      });
    }, 1000);
    setTimeout(function () {
      if (table.getPlayersCount() >= 2 && !table.gameStarted) {
        setTimeout(function () {
          socket.emit(gameCountDown, {
            counter: 7,
          });
          socket.broadcast.to(room).emit(gameCountDown, {
            counter: 7,
          });
        }, 1000);
        setTimeout(function () {
          if (table.getPlayersCount() >= 2 && !table.gameStarted) {
            table.startGame();
            var sentObj = {
              players: table.getPlayers(),
              table: table.getTableInfo(),
            };
            socket.emit(startNew, sentObj);
            socket.broadcast.to(room).emit(startNew, sentObj);
          } else if (table.getPlayersCount() == 1 && !table.gameStarted) {
            socket.emit(showWinner, {
              players: players,
              table: table.getTableInfo(),
              packed: true,
            });
            socket.broadcast.to(room).emit(showWinner, {
              players: players,
              table: table.getTableInfo(),
              packed: true,
            });
          }
        }, 8000);
      }
      if (table.getPlayersCount() == 1 && !table.gameStarted) {
        socket.emit(showWinner, {
          players: players,
          table: table.getTableInfo(),
          packed: true,
        });
        socket.broadcast.to(room).emit(showWinner, {
          players: players,
          table: table.getTableInfo(),
          packed: true,
        });
      }
    }, 118000);
    // if (table.getPlayersCount() >= 2 && !table.gameStarted) {
    //   setTimeout(function () {
    //     socket.emit("gameCountDown", {
    //       counter: 7,
    //     });
    //     socket.broadcast.to(room).emit("gameCountDown", {
    //       counter: 7,
    //     });
    //   }, 1000);
    //   setTimeout(function () {
    //     if (table.getPlayersCount() >= 2 && !table.gameStarted) {
    //       table.startGame();
    //       var sentObj = {
    //         players: table.getPlayers(),
    //         table: table.getTableInfo(),
    //       };
    //       socket.emit(startNew, sentObj);
    //       socket.broadcast.to(room).emit(startNew, sentObj);
    //     } else if (table.getPlayersCount() == 1 && !table.gameStarted) {
    //       socket.emit(notification, {
    //         message: "Please wait for more players to join",
    //         timeout: 4000,
    //       });
    //       socket.broadcast.to(room).emit(notification, {
    //         message: "Please wait for more players to join",
    //         timeout: 4000,
    //       });
    //     }
    //   }, 9000);
    // } else if (table.getPlayersCount() == 1 && !table.gameStarted) {
    //   socket.emit(notification, {
    //     message: "Please wait for more players to join",
    //     timeout: 4000,
    //   });
    //   socket.broadcast.to(room).emit(notification, {
    //     message: "Please wait for more players to join",
    //     timeout: 4000,
    //   });
    // }
  }

  function startNewGame(after) {
    if (table.getPlayersCount() >= 2 && !table.gameStarted) {
      setTimeout(function () {
        socket.emit(gameCountDown, {
          counter: 9,
        });
        socket.broadcast.to(room).emit(gameCountDown, {
          counter: 9,
        });
      }, after || 6000);
      setTimeout(function () {
        if (table.getPlayersCount() >= 2 && !table.gameStarted) {
          table.startGame();
          var sentObj = {
            players: table.getPlayers(),
            table: table.getTableInfo(),
          };
          socket.emit(startNew, sentObj);
          socket.broadcast.to(room).emit(startNew, sentObj);
        } else if (table.getPlayersCount() == 1) {
          socket.emit(notification, {
            message: "Please wait for more players to join",
            timeout: 4000,
          });
          socket.broadcast.to(room).emit(notification, {
            message: "Please wait for more players to join",
            timeout: 4000,
          });
          // setTimeout(function() {
          table.reset();
          var sentObj = {
            players: table.getPlayers(),
            table: table.getTableInfo(),
          };
          socket.emit(resetTable, sentObj);
          socket.broadcast.to(room).emit(resetTable, sentObj);
          // }, 7000);
        }
      }, 13000);
    } else if (table.getPlayersCount() == 1) {
      setTimeout(function () {
        socket.emit(notification, {
          message: "Please wait for more players to join",
          timeout: 4000,
        });
        socket.broadcast.to(room).emit(notification, {
          message: "Please wait for more players to join",
          timeout: 4000,
        });
      }, 4000);
      setTimeout(function () {
        table.reset();
        var sentObj = {
          players: table.getPlayers(),
          table: table.getTableInfo(),
        };
        socket.emit(resetTable, sentObj);
        socket.broadcast.to(room).emit(resetTable, sentObj);
      }, 4000);
    }
  }

  socket.on(placeBet, function (args) {
    var players = table.placeBet(
      args.player.id,
      args.bet.amount,
      args.bet.blind,
      args.player.playerInfo._id
    );
    if (args.bet.show || table.isPotLimitExceeded()) {
      args.bet.show = true;
      var msg = table.decideWinner(args.bet.show);
      socket.emit(showWinner, {
        message: msg,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        potLimitExceeded: table.isPotLimitExceeded(),
      });
      socket.broadcast.to(room).emit(showWinner, {
        message: msg,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        potLimitExceeded: table.isPotLimitExceeded(),
      });
      table.stopGame();
      // startNewGame();
    } else {
      socket.emit(betPlaced, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
      socket.broadcast.to(room).emit(betPlaced, {
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
    }
  });

  socket.on(respondSideShow, function (args) {
    var players = table.getPlayers(),
      msg = "";
    table.resetSideShowTurn();
    if (args.lastAction === "Denied") {
      table.setNextPlayerTurn();
      table.sideShowDenied(args.player.id);
      msg = [args.player.playerInfo.userName, " has denied side show"].join("");
      socket.emit(sideShowResponded, {
        message: msg,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
      socket.broadcast.to(room).emit(sideShowResponded, {
        message: msg,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
    } else if (args.lastAction === "Accepted") {
      table.setNextPlayerTurn();
      msg = table.sideShowAccepted(args.player.id);
      socket.emit(sideShowResponded, {
        message: msg.message,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
      socket.broadcast.to(room).emit(sideShowResponded, {
        message: msg.message,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
    }
  });
  socket.on(placeSideShow, function (args) {
    var sideShowMessage = table.placeSideShow(
      args.player.id,
      args.bet.amount,
      args.bet.blind,
      args.player.playerInfo._id
    );
    var players = table.getPlayers();
    if (table.isPotLimitExceeded()) {
      args.bet.show = true;
      var msg = table.decideWinner(args.bet.show);
      socket.emit(showWinner, {
        message: msg,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        potLimitExceeded: table.isPotLimitExceeded(),
      });
      socket.broadcast.to(room).emit(showWinner, {
        message: msg,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
        potLimitExceeded: table.isPotLimitExceeded(),
      });
      table.stopGame();
      // startNewGame();
    } else {
      socket.emit(sideShowPlaced, {
        message: sideShowMessage,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
      socket.broadcast.to(room).emit(sideShowPlaced, {
        message: sideShowMessage,
        bet: args.bet,
        placedBy: args.player.id,
        players: players,
        table: table.getTableInfo(),
      });
    }
  });

  socket.on(chat, function (args) {
    let chatMessage = table.chat(args.id, args.msg);
    socket.emit(recieve, chatMessage);
    socket.broadcast.to(room).emit(recieve, chatMessage);
  });

  //    socket.on(getAllTable,()=>{
  //     socket.emit(tablesList,{
  //         tables:tables.getAllTables()
  //     })
  //    })

  socket.on(deleteTable, (args) => {
    let tables = tables.deleteTable(args.guid);
    socket.emit(tablesList, {
      tables: tables,
    });
  });
  // here a player is leaving the game
  socket.on(disconnect, function () {
    if (table.gameStarted && table.isActivePlayer(socket.id)) {
      table.packPlayer(socket.id);
    }
    var removedPlayer = table.removePlayer(socket.id);
    console.log("disconnect for " + socket.id);
    console.log("total players left:" + table.getActivePlayers());
    socket.broadcast.to(room).emit(playerLeft, {
      bet: {
        lastAction: "Packed",
        lastBet: "",
      },
      removedPlayer: removedPlayer,

      players: table.getPlayers(),
      table: table.getTableInfo(),
    });
    if (table.getActivePlayers() == 1 && table.gameStarted) {
      table.decideWinner();
      socket.emit(showWinner, {
        bet: {
          lastAction: "Packed",
          lastBet: "",
        },
        placedBy: removedPlayer.id,
        players: table.getPlayers(),
        table: table.getTableInfo(),
        packed: true,
      });
      socket.broadcast.to(room).emit(showWinner, {
        bet: {
          lastAction: "Packed",
          lastBet: "",
        },
        placedBy: removedPlayer.id,
        players: table.getPlayers(),
        table: table.getTableInfo(),
        packed: true,
      });
      table.stopGame();
      // startNewGame();
    }
  });

  socket.on("left", function () {
    if (table.gameStarted && table.isActivePlayer(socket.id)) {
      table.packPlayer(socket.id);
    }
    var removedPlayer = table.removePlayer(socket.id);
    console.log("disconnect for " + socket.id);
    console.log("total players left:" + table.getActivePlayers());
    socket.broadcast.to(room).emit(playerLeft, {
      bet: {
        lastAction: "Packed",
        lastBet: "",
      },
      removedPlayer: removedPlayer,
      players: table.getPlayers(),
      table: table.getTableInfo(),
    });
    if (table.getActivePlayers() == 1 && table.gameStarted) {
      table.decideWinner();
      socket.emit(showWinner, {
        bet: {
          lastAction: "Packed",
          lastBet: "",
        },
        placedBy: removedPlayer.id,
        players: table.getPlayers(),
        table: table.getTableInfo(),
        packed: true,
      });
      socket.broadcast.to(room).emit(showWinner, {
        bet: {
          lastAction: "Packed",
          lastBet: "",
        },
        placedBy: removedPlayer.id,
        players: table.getPlayers(),
        table: table.getTableInfo(),
        packed: true,
      });
      table.stopGame();
      // startNewGame();
    }
  });

  // socket.on("kickOut", function (args) {
  //   if (table.gameStarted && table.isActivePlayer(args.id)) {
  //     table.packPlayer(args.id);
  //   }
  //   let players = table.getPlayers();
  //   let removedplayer = players[args.id];
  //   removedplayer["kickout"] = true;
  //   socket.to(args.id).emit("playerKickOut", {
  //     bet: {
  //       lastAction: "Kick Out",
  //       lastBet: "",
  //     },
  //     players: players,
  //     table: table.getTableInfo(),
  //     removedplayer: removedplayer,
  //   });
  //   socket.broadcast.to(room).emit("playerKickOut", {
  //     bet: {
  //       lastAction: "Kick Out",
  //       lastBet: "",
  //     },
  //     players: players,
  //     table: table.getTableInfo(),
  //     removedplayer: removedplayer,
  //   });
  // });
}
