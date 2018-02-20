const builder = require('botbuilder')
const axios = require('axios')
const Rx = require ('xregexp')
const Alan = require('./alan')

var rx = require('./regexps')

module.exports = {

    check: (alan) => {
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

    choose: (alan) => {
        alan.choice.var = alan.command.argument
    },

    'choose.go': [
        (alan, session, results, next) => {
            alan.choice.feed = alan.item
            alan.do('choose.step')
            next()
        },
        (alan, session) => {
            builder.Prompts.choice(session, alan.messages.shift(), alan.choice.branches, { listStyle: 3 })
        },
        (alan, session, results) => {
            let choice = alan.choice
            alan.command.result = results.entity
            alan.setVar(choice.var, results.entity)
            alan.branches.unshift(choice.branches[results.entity])
            alan.choice = Alan.default.choice                
        }
    ],

    'choose.step': alan => {
        let choice = alan.choice
        if (choice.feed.length == 0) {
            return
        }
        choice.item = choice.feed.shift()
        let item = choice.item
        if (Array.isArray(item)) {
            choice.expectsCode = true
        } else {
            for (operatorName in rx.args.choose) {
                let operatorArgs = rx.args.choose[operatorName].xregexp.source
                let regex = Rx(`^${operatorName} ${operatorArgs}`)
                let match = Rx.exec(item, regex)
                if (match) {
                    choice.expectsCode = true
                    choice.operator = {
                        name: operatorName,
                        args: match
                    }
                    let operatorCommand = 'choose.' + choice.operator.name                        
                    choice.expectsCode = true
                    alan.do(operatorCommand)                    
                    return alan.switchTo('choose.step')
                }
            }
            if (!choice.expectsCode) {
                choice.options.unshift(item)
                choice.expectsCode = true
                return alan.switchTo('choose.step')
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
        alan.switchTo('choose.step')
    },

    'choose.among': (alan) => {
        let choice = alan.choice
        let what = choice.operator.args.what
        let options = alan.getVar(what)
        choice.options.unshift(options)
    },

    'choose.need': (alan) => {
        let choice = alan.choice
        let variable = alan.getVar(choice.operator.args.what)
        if (!variable) {
            choice.options.shift()
            choice.feed.shift()
            choice.expectsCode = false
        }
    },

    go: [(alan) => {
        alan.do('step', {replace: true})
    }],

    goto: (alan) => {
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

    load: [
        (alan) => {
            builder.Prompts.attachment(session, alan.messages.pop())
        },
        (alan, session, results, next) => {
            bot.connector('*').getAccessToken(
                (err, token) => {
                    let file = results.response[0]
                    axios({
                        method: 'get',
                        url: file.contentUrl,
                        responseType: 'stream',
                        headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/octet-stream'
                    }}).then(
                        (response) => {                            
                            file.data = response.data._readableState.buffer.head
                            alan.vars[alan.command.argument] = file
                            next()
                        }
                    )
                }
            )
        },
        (alan) => {}
    ],

    print: [(alan, session) => {        
        while (alan.messages.length > 0) {
            session.send(alan.messages.shift())
        }
        session.sendTyping()
        let str = alan.formatString(alan.command.argument)
        alan.messages.push(str)
    }],

    read: [
        (alan, session) => {
            builder.Prompts.text(session, alan.messages.pop())
        },
        (alan, session, results) => {
            alan.command.result = results.response
            alan.vars[alan.command.argument] = alan.command.result;
        }
    ],

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

    next: [alan => {}],

    step: [
        (alan, session, args, next) => {
            let branch = alan.branches[0]
            alan.item = branch.shift()
            let item = alan.item
            console.log(item)
            alan.parseCommand()
            let commandName = alan.command.name
            alan.do(commandName)
            if (!Alan.isAsync(commandName)) {
                next()
            }
        },
        (alan) => {
            let branch = alan.branches[0]
            if (branch.length == 0) {
                alan.branches.shift()
                if (alan.branches.length == 0) {
                    alan.branches = [Alan.code.slice()]
                }
            }
            alan.do('step', {replace: true})
        }
    ]
}