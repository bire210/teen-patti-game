
const { joinTable, newPlayerJoined, connectionSuccess, seeMyCards, cardsSeen, placePack, showWinner, playerPacked, notification, startNew, resetTable, gameCountDown, placeBet, betPlaced, respondSideShow, sideShowResponded, sideShowPlaced, disconnect, playerLeft, placeSideShow } = require('./action');
var tables = require('./tabledecks');
class Io {
        init(socket,io,boot,privateKey) {
         console.log("Socket is conneted here");
                let table;
                if (privateKey) {
                    table = tables.getTable(privateKey);
                    if (!table) {
                        table = tables.createNewTable(boot, privateKey);
                        console.log("new private table",table);
                    }else{
                        console.log("players list",table.getPlayers());
                    }
                } else {
                    table = tables.getNotFullTable();
                    if (!table) {
                        table = tables.createNewTable();
                        console.log("a new  table is created :", table)
                    } else {
                        console.log("existing table", tables.listOfTable[0].getPlayers());
                    }
                }
                const room = table.gid;
                console.log(room);
                //  socket.join(room);

                socket.on("joinTable",  (args)=> {
                    console.log("it is comming from fronted", args);
                     socket.join(room);
                    var addedPlayer = table.addPlayer({
                        id: socket.id,
                        cardSet: {
                            closed: true
                        },
                        playerInfo: args
                    }, socket);
                    console.log('now player count is:' + table.getActivePlayers());
                    if (addedPlayer !== false) {
                        var newPlayer = {
                            id: socket.id,
                            tableId: table.gid,
                            slot: addedPlayer.slot,
                            active: addedPlayer.active,
                            packed: addedPlayer.packed,
                            playerInfo: args,
                            cardSet: addedPlayer.cardSet,
                            otherPlayers: table.getPlayers()
                        };
                        socket.emit(joinTable, newPlayer);
                        socket.broadcast.to(room).emit(newPlayerJoined, newPlayer);
                        startNewGameOnPlayerJoin();
                    }
                });
                socket.emit(connectionSuccess, {
                    id: socket.id,
                    tableId: table.gid
                });


                socket.on(seeMyCards, function (args) {

                    var cardsInfo = table.getCardInfo()[args.id].cards;
                    table.updateSideShow(args.id);
                    socket.emit(cardsSeen, {
                        cardsInfo: cardsInfo,
                        players: table.getPlayers()
                    });
                    socket.broadcast.to(room).emit('playerCardSeen', {
                        id: args.id,
                        players: table.getPlayers()
                    });
                });

                socket.on(placePack, function (args) {
                    var players = table.packPlayer(args.player.id);
                    if (table.getActivePlayers() === 1) {
                        table.decideWinner();
                        socket.emit('showWinner', {
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo(),
                            packed: true

                        });
                        socket.broadcast.to(room).emit(showWinner, {
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo(),
                            packed: true
                        });
                        table.stopGame();
                        startNewGame();

                    } else {
                        socket.emit(playerPacked, {
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo()
                        });
                        socket.broadcast.to(room).emit(playerPacked, {
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo()
                        });
                    }
                });

                function startNewGameOnPlayerJoin() {
                    if (table.getPlayersCount() >= 2 && !table.gameStarted) {
                        setTimeout(function () {
                            socket.emit('gameCountDown', {
                                counter: 7
                            });
                            socket.broadcast.to(room).emit('gameCountDown', {
                                counter: 7
                            });
                        }, 1000);
                        setTimeout(function () {
                            if (table.getPlayersCount() >= 2 && !table.gameStarted) {
                                table.startGame();
                                var sentObj = {
                                    players: table.getPlayers(),
                                    table: table.getTableInfo()
                                };
                                socket.emit(startNew, sentObj);
                                socket.broadcast.to(room).emit(startNew, sentObj);
                            } else if (table.getPlayersCount() == 1 && !table.gameStarted) {
                                socket.emit(notification, {
                                    message: 'Please wait for more players to join',
                                    timeout: 4000
                                });
                                socket.broadcast.to(room).emit(notification, {
                                    message: 'Please wait for more players to join',
                                    timeout: 4000
                                });
                            }
                        }, 9000);
                    } else if (table.getPlayersCount() == 1 && !table.gameStarted) {
                        socket.emit(notification, {
                            message: 'Please wait for more players to join',
                            timeout: 4000
                        });
                        socket.broadcast.to(room).emit(notification, {
                            message: 'Please wait for more players to join',
                            timeout: 4000
                        });
                    }
                }

                function startNewGame(after) {
                    if (table.getPlayersCount() >= 2 && !table.gameStarted) {
                        setTimeout(function () {
                            socket.emit(gameCountDown, {
                                counter: 9
                            });
                            socket.broadcast.to(room).emit(gameCountDown, {
                                counter: 9
                            });
                        }, after || 6000);
                        setTimeout(function () {
                            if (table.getPlayersCount() >= 2 && !table.gameStarted) {
                                table.startGame();
                                var sentObj = {
                                    players: table.getPlayers(),
                                    table: table.getTableInfo()
                                };
                                socket.emit(startNew, sentObj);
                                socket.broadcast.to(room).emit(startNew, sentObj);
                            } else if (table.getPlayersCount() == 1) {
                                socket.emit(notification, {
                                    message: 'Please wait for more players to join',
                                    timeout: 4000
                                });
                                socket.broadcast.to(room).emit(notification, {
                                    message: 'Please wait for more players to join',
                                    timeout: 4000
                                });
                                // setTimeout(function() {
                                table.reset();
                                var sentObj = {
                                    players: table.getPlayers(),
                                    table: table.getTableInfo()
                                };
                                socket.emit(resetTable, sentObj);
                                socket.broadcast.to(room).emit(resetTable, sentObj);
                                // }, 7000);
                            }
                        }, 13000);
                    } else if (table.getPlayersCount() == 1) {
                        setTimeout(function () {
                            socket.emit(notification, {
                                message: 'Please wait for more players to join',
                                timeout: 4000
                            });
                            socket.broadcast.to(room).emit(notification, {
                                message: 'Please wait for more players to join',
                                timeout: 4000
                            });
                        }, 4000);
                        setTimeout(function () {
                            table.reset();
                            var sentObj = {
                                players: table.getPlayers(),
                                table: table.getTableInfo()
                            };
                            socket.emit(resetTable, sentObj);
                            socket.broadcast.to(room).emit(resetTable, sentObj);
                        }, 4000);
                    }
                }

                socket.on(placeBet, function (args) {

                    var players = table.placeBet(args.player.id, args.bet.amount, args.bet.blind, args.player.playerInfo._id);
                    if (args.bet.show || table.isPotLimitExceeded()) {
                        args.bet.show = true;
                        var msg = table.decideWinner(args.bet.show);
                        socket.emit(showWinner, {
                            message: msg,
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo(),
                            potLimitExceeded: table.isPotLimitExceeded()
                        });
                        socket.broadcast.to(room).emit(showWinner, {
                            message: msg,
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo(),
                            potLimitExceeded: table.isPotLimitExceeded()
                        });
                        table.stopGame();
                        startNewGame();
                    } else {
                        socket.emit(betPlaced, {
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo()

                        });
                        socket.broadcast.to(room).emit(betPlaced, {
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo()
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
                        msg = [args.player.playerInfo.userName, ' has denied side show'].join('');
                        socket.emit(sideShowResponded, {
                            message: msg,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo()
                        });
                        socket.broadcast.to(room).emit(sideShowResponded, {
                            message: msg,
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo()
                        });

                    } else if (args.lastAction === "Accepted") {
                        table.setNextPlayerTurn();
                        msg = table.sideShowAccepted(args.player.id);
                        socket.emit(sideShowResponded, {
                            message: msg.message,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo()
                        });
                        socket.broadcast.to(room).emit(sideShowResponded, {
                            message: msg.message,
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo()
                        });
                    }
                });
                socket.on(placeSideShow, function (args) {
                    var sideShowMessage = table.placeSideShow(args.player.id, args.bet.amount, args.bet.blind, args.player.playerInfo._id);
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
                            potLimitExceeded: table.isPotLimitExceeded()
                        });
                        socket.broadcast.to(room).emit('showWinner', {
                            message: msg,
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo(),
                            potLimitExceeded: table.isPotLimitExceeded()
                        });
                        table.stopGame();
                        startNewGame();
                    } else {
                        socket.emit(sideShowPlaced, {
                            message: sideShowMessage,
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo()

                        });
                        socket.broadcast.to(room).emit(sideShowPlaced, {
                            message: sideShowMessage,
                            bet: args.bet,
                            placedBy: args.player.id,
                            players: players,
                            table: table.getTableInfo()
                        });
                    }
                });
            //  here a player is leaving the game
                // socket.on(disconnect, function () {
                //     if (table.gameStarted && table.isActivePlayer(socket.id)) {
                //         table.packPlayer(socket.id);
                //     }
                //     var removedPlayer = table.removePlayer(socket.id);
                //     console.log('disconnect for ' + socket.id);
                //     console.log('total players left:' + table.getActivePlayers());
                //     socket.broadcast.to(room).emit(playerLeft, {
                //         bet: {
                //             lastAction: "Packed",
                //             lastBet: ""
                //         },
                //         removedPlayer: removedPlayer,
                //         placedBy: removedPlayer.id,
                //         players: table.getPlayers(),
                //         table: table.getTableInfo()
                //     });
                //     if (table.getActivePlayers() == 1 && table.gameStarted) {
                //         table.decideWinner();
                //         socket.emit(showWinner, {
                //             bet: {
                //                 lastAction: "Packed",
                //                 lastBet: ""
                //             },
                //             placedBy: removedPlayer.id,
                //             players: table.getPlayers(),
                //             table: table.getTableInfo(),
                //             packed: true

                //         });
                //         socket.broadcast.to(room).emit(showWinner, {
                //             bet: {
                //                 lastAction: "Packed",
                //                 lastBet: ""
                //             },
                //             placedBy: removedPlayer.id,
                //             players: table.getPlayers(),
                //             table: table.getTableInfo(),
                //             packed: true
                //         });
                //         table.stopGame();
                //         startNewGame();
                //     }
                // });
            socket.on(disconnect,()=>{
                console.log("disconected");
            })

        }
    }
module.exports = new Io();