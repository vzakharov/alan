let item = commands[name]
if (typeof item === 'function') {
    continue
}
let functionStack = item.slice()
let dialogName = 'alan.' + name
let dialogStack = []
while (functionStack.length > 0) {
    let command = functionStack.shift()
    dialogStack.push((session, results) => {
        let alan = getAlan(session)
        command(alan, session, results)
    })
}
bot.dialog(dialogName, dialogStack)