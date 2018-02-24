const axios = require('axios')
const Rx = require ('xregexp')
const Alan = require('./alan')

var rx = require('./regexps')

class AlanWithCommands extends Alan {

    constructor(session) {
        super(session)
    }

    _check() {
        let name = this.command.argument
        let value = this.vars[name]
        let branch = this.branches[0]
        let fork = branch.shift()
        let options = {}
        for (let i = 0; i < fork.length; i += 2) {
            if (fork[i] == value || fork[i] == 'else') {
                this.branches.unshift(fork[i + 1])
                return
            }
        }
    }

    _choose() {
        this.choice.var = this.command.argument
    }

    async _choose_() {
        this.choice.feed = this.item
        let choice = this.choice
        while (choice.feed.length > 0) {
            choice.item = choice.feed.shift()
            let item = choice.item
            if (Array.isArray(item)) {
                choice.expectsCode = true
            } else {
                let match
                for (var operatorName in rx.args.choose) {
                    let operatorArgs = rx.args.choose[operatorName].xregexp.source
                    let regex = Rx(`^${operatorName} ${operatorArgs}`)
                    match = Rx.exec(item, regex)
                    if (match) {
                        choice.expectsCode = true
                        choice.operator = {
                            name: operatorName,
                            args: match
                        }
                        let operatorCommand = 'choose_' + choice.operator.name                        
                        choice.expectsCode = true
                        await this.do(operatorCommand)
                        break
                    }
                }
                if (match) continue
                if (!choice.expectsCode) {
                    choice.options.unshift(item)
                    choice.expectsCode = true
                    continue
                }
            }                
            if (choice.expectsCode) {
                let options = choice.options[0]
                if (!Array.isArray(options)) {
                    options = [options]
                }
                options.forEach(option => {
                    choice.branches[option] = choice.item                        
                });
                choice.expectsCode = false
            }
        }
        await this.prompt('choice', this.choice.branches, { listStyle: 3 })

        let results = this.dialog.results
        let chosenItem = results.response.entity

        this.command.results = chosenItem
        this.setVar(choice.var, chosenItem)
        this.branches.unshift(choice.branches[chosenItem])
        this.choice = Alan.default.choice            
    }

    _choose_among() {
        let choice = this.choice
        let what = choice.operator.args.what
        let options = this.getVar(what)
        choice.options.unshift(options)
    }

    _choose_need() {
        let choice = this.choice
        let variable = this.getVar(choice.operator.args.what)
        if (!variable) {
            choice.options.shift()
            choice.feed.shift()
            choice.expectsCode = false
        }
    }

    _goto() {
        let where = this.command.argument.slice()
        if (typeof where == 'string') {
            where = Alan.labels[where].slice()
        }
        let labelName = this.command.argument
        
        this.branches = []
        let branchToAdd = [Alan.code]
        while (where.length > 0) {
            this.branches.unshift(branchToAdd[0].slice(where.shift()))
            branchToAdd = this.branches[0]
        }
    }

    async _load() {
        await this.prompt('attachment')
        let results = this.dialog.results
        await new Promise((resolve, reject) => {
            Alan.bot.connector('*').getAccessToken(
                async (err, token) => {
                    let file = results.response[0]
                    let response = await axios({
                        method: 'get',
                        url: file.contentUrl,
                        responseType: 'stream',
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/octet-stream'
                        }
                    })
                    file.data = response.data._readableState.buffer.head
                    this.vars[this.command.argument] = file
                    resolve()
                }
            )
        })
    }

    _print() {        
        let session = this.session
        while (this.messages.length > 0) {
            session.send(this.messages.shift())
        }
        session.sendTyping()
        let str = this.formatString(this.command.argument)
        this.messages.push(str)
    }

    async _read() {
        await this.prompt('text')
        let text = this.dialog.results.response
        this.command.results = text
        this.vars[this.command.argument] = text;
    }

    _set() {
        let args = Rx.exec(this.command.argument, rx.args['set'])
        let value
        //let args = argument.split(' ')
        if (args.boolean) {
            value = 1
        } else if (args.number) {
            value = Number(args.number)
        } else if (args.toNextItem) {
            value = this.branches[0].shift()
        } else if (args.var) {
            value = this.getVar(args.var)
        } else {
            value = args.value
        }
        this.setVar(args.what, value)
    }

    _next() {}
}

module.exports = AlanWithCommands