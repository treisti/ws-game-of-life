var path = require('path');
var app = require('express')();
var ws = require('express-ws')(app);


class Cell {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}
}

class Board {
	constructor() {
		this.map = new Map();
	}

	reset() {
		this.map.clear();
	}

	getHash(x, y) {
		return x + ";" + y;
	}

	placeCell(x, y) {
		const hash = this.getHash(x, y);
		const cell = new Cell(x, y)
		this.map.set(hash, cell);
		console.error('cell placed: ' + hash);
	}

	removeCell(x, y) {
		const hash = this.getHash(x, y);
		this.map.delete(hash);
		console.error('cell removed: ' + hash);
	}

	getCells(fromX, fromY, toX, toY) {
		var cells = [];
		for(let x = fromX; x < toX; x++) {
			for(let y = fromY; y < toY; y++) {
				const hash = this.getHash(x, y);
				if(this.map.has(hash)) {
					cells.push(this.map.get(hash));
				}
			}
		}
		return cells;
	}


	countAlive(x, y) {
		let aliveCount = 0;
		for(let i = -1; i <= 1; i++) {
			for(let j = -1; j <= 1; j++) {
				const hash = this.getHash(x + i, y + j);
				if(this.map.has(hash)) {
					aliveCount++;
				}
			}
		}
		return aliveCount;
	}

	isAlive(cell) {
		let aliveCount = this.countAlive(cell.x, cell.y);
		return (aliveCount == 3 || aliveCount == 4);
	}

	willBorn(x, y) {
		const hash = this.getHash(x, y);
		if(!this.map.has(hash)) {
			let aliveCount = this.countAlive(x, y);
			return (aliveCount == 3);
		}
		return false;
	}

	advance() {
		let newMap = new Map();
		for(let [hash, cell] of this.map) {
			if(this.isAlive(cell)) {
				newMap.set(hash, cell);
			}
			for(let x = cell.x - 1; x <= cell.x + 1; x++) {
				for(let y = cell.y - 1; y <= cell.y + 1; y++) {
					if(this.willBorn(x, y)) {
						const hash = this.getHash(x, y);
						const cell = new Cell(x, y)
						newMap.set(hash, cell);
					}
				}
			}
		}
		this.map = newMap;
	}
}

class Game {
	constructor(onTick = null) {
		this.interval = null;
		this.isRunning = false;
		this.board = new Board();
		this.onTick = onTick;
	}

	run(intervalMilliseconds) {
		function tick() {
			this.board.advance();
			this.doTick();
		}

		this.stop();
		this.interval = setInterval(tick.bind(this), intervalMilliseconds);
		this.isRunning = true;
	}

	stop() {
		if(this.isRunning) {
			clearInterval(this.interval);
			this.interval = null;
			this.isRunning = false;
		}
		this.doTick();
	}

	doTick() {
		if(this.onTick != null) {
			this.onTick();
		}
	}
}

class Client {
	constructor(socket, game, onClose) {
		this.socket = socket;
		this.socket.addEventListener('message', this.onMessage.bind(this));
		this.socket.addEventListener('close', onClose);
		this.game = game;
		this.startX = 0;
		this.startY = 0;
		this.endX = 0;
		this.endY = 0;
		this.sendState();
	}

	onMessage(message) {
		let data = JSON.parse(message.data);

		switch(data.type) {
			case "run":
				this.game.run(data.intervalMilliseconds);
				break;
			case "stop":
				this.game.stop();
				break;
			case "reset":
				this.game.board.reset();
				this.game.stop();
				break;
			case "coordinates":
				this.startX = data.startX;
				this.startY = data.startY;
				this.endX = data.endX;
				this.endY = data.endY;
				this.sendCells();
				break;
			case "placeCell":
				this.game.board.placeCell(data.x, data.y);
				this.game.doTick();
				break;
			case "removeCell":
				this.game.board.removeCell(data.x, data.y);
				this.game.doTick();
				break;
			case "getCells":
				this.sendCells();
				break;
			case "getState":
				this.sendState();
				break;
		}
	}

	sendCells() {
		let cells = this.game.board.getCells(this.startX, this.startY, this.endX, this.endY);
		let data = {
			type: "cells",
			cells: cells
		};
		this.socket.send(JSON.stringify(data));
	}

	sendState() {
		let data = {
			type: "state",
			isRunning: this.game.isRunning
		};
		this.socket.send(JSON.stringify(data));
	}
}


app.get('/', (req, res) => {
  console.error('http connection');
  res.sendFile(path.join(__dirname, 'ws.html'));
});

app.ws('/', (s, req) => {
	let client = new Client(s, game, function() {
		for(let i = 0; i < clients.length; i++){ 
		   if (clients[i] === client) {
		     clients.splice(i, 1); 
		   }
		}
		console.error('closed websocket');
		console.error('number of clients: ' + clients.length);
	})
	clients.push(client);
	console.error('opened websocket');
	console.error('number of clients: ' + clients.length);
});


let clients = [];
let game = new Game(function() {
	clients.forEach(function(client) {
		try {
			client.sendCells();
			client.sendState();
		} catch(error) {
			console.error('websocket error');
		}
	});
});

app.listen(3001, () => console.error('listening on http://localhost:3001/'));
console.error('ws-game-of-life');
