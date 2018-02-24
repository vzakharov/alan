const axios = require('axios')
const Rx = require ('xregexp')
const Alan = require('./alan')

var rx = require('./regexps')

Alan.commands = {

    check: alan => {
        let name = alan.command.argument
        let value = alan.vars[name]
        let branch = alan.branches[0]
        let fork = branch.shift()
        let options = {}
        for (let i = 0; i < fork.length; i += 2) {
            if (fork[i] == value || fork[i] == 'else') {
                alan.branches.unshift(fork[i + 1])
                return
            }
        }
    },

    choose: alan => {
        alan.choice.var = alan.command.argument
    },

    'choose_': async alan => {
        alan.choice.feed = alan.item
        let choice = alan.choice
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
                        let operatorCommand = 'choose_.' + choice.operator.name                        
                        choice.expectsCode = true
                        await alan.do(operatorCommand)
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
        await alan.prompt('choice', alan.choice.branches, { listStyle: 3 })

        let results = alan.dialog.results
        let chosenItem = results.response.entity

        alan.command.results = chosenItem
        alan.setVar(choice.var, chosenItem)
        alan.branches.unshift(choice.branches[chosenItem])
        alan.choice = Alan.default.choice            
    },

    'choose_.among': (alan) => {
        let choice = alan.choice
        let what = choice.operator.args.what
        let options = alan.getVar(what)
        choice.options.unshift(options)
    },

    'choose_.need': (alan) => {
        let choice = alan.choice
        let variable = alan.getVar(choice.operator.args.what)
        if (!variable) {
            choice.options.shift()
            choice.feed.shift()
            choice.expectsCode = false
        }
    },

    goto: alan => {
        let where = alan.command.argument.slice()
        if (typeof where == 'string') {
            where = Alan.labels[where].slice()
        }
        let labelName = alan.command.argument
        
        alan.branches = []
        let branchToAdd = [Alan.code]
        while (where.length > 0) {
            alan.branches.unshift(branchToAdd[0].slice(where.shift()))
            branchToAdd = alan.branches[0]
        }
    },

    load: async alan => {
        await alan.prompt('attachment')
        let results = alan.dialog.results
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
                    alan.vars[alan.command.argument] = file
                    resolve()
                }
            )
        })
    },

    print: alan => {        
        let session = alan.session
        while (alan.messages.length > 0) {
            session.send(alan.messages.shift())
        }
        session.sendTyping()
        let str = alan.formatString(alan.command.argument)
        alan.messages.push(str)
    },

    read: async alan => {
        await alan.prompt('text')
        let text = alan.dialog.results.response
        alan.command.results = text
        alan.vars[alan.command.argument] = text;
    },

    set: alan => {
        let args = Rx.exec(alan.command.argument, rx.args['set'])
        let value
        //let args = argument.split(' ')
        if (args.boolean) {
            value = 1
        } else if (args.number) {
            value = Number(args.number)
        } else if (args.toNextItem) {
            value = alan.branches[0].shift()
        } else if (args.var) {
            value = alan.getVar(args.var)
        } else {
            value = args.value
        }
        alan.setVar(args.what, value)
    },

    next: () => {}
}