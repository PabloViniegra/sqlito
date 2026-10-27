# SQLito demo — run through demo/render.sh, which prepares /tmp/sqlito-demo
# (bundled CLI shim, a copy of fixtures/sample.db and isolated XDG dirs).

Output demo/output/sqlito-demo.raw.mp4

Require node

Set Shell "bash"
# Mirrors the author's Ghostty setup (Vesper theme, Dank Mono): VHS renders
# through xterm.js, so Ghostty itself can't be used. Line height is tighter
# than Ghostty's +35% so a whole result table fits on screen.
Set FontFamily "DankMono Nerd Font Mono"
Set FontSize 26
Set LineHeight 1.2
Set Width 1920
Set Height 1080
Set Margin 48
Set MarginFill "#24201C"
Set Padding 28
Set WindowBar Colorful
Set WindowBarSize 44
Set BorderRadius 14
Set Framerate 30
Set TypingSpeed 38ms
Set CursorBlink false
Set Theme { "name": "Vesper", "background": "#101010", "foreground": "#FFFFFF", "cursor": "#ACB1AB", "selection": "#988049", "black": "#101010", "red": "#F5A191", "green": "#90B99F", "yellow": "#E6B99D", "blue": "#ACA1CF", "magenta": "#E29ECA", "cyan": "#EA83A5", "white": "#A0A0A0", "brightBlack": "#7E7E7E", "brightRed": "#FF8080", "brightGreen": "#99FFE4", "brightYellow": "#FFC799", "brightBlue": "#B9AEDA", "brightMagenta": "#ECAAD6", "brightCyan": "#F591B2", "brightWhite": "#FFFFFF" }

Hide
Type "cd /tmp/sqlito-demo && export PATH=$PWD/bin:$PATH XDG_DATA_HOME=$PWD/xdg XDG_CONFIG_HOME=$PWD/xdg PS1='\[\e[36m\]❯\[\e[0m\] ' && clear"
Enter
Sleep 500ms
Show

# 1 · Launch: the header plays its intro.
Sleep 300ms
Type "sqlito shop.db"
Sleep 300ms
Enter
Wait+Screen /── default/
Sleep 1.3s

# 2 · Command palette, filtered down to .tables.
Ctrl+P
Wait+Screen /COMMAND/
Sleep 700ms
Type@90ms "tab"
Sleep 700ms
Enter
Wait+Screen /order_totals/
Sleep 1.1s

# 3 · A query written with table and column autocompletion.
Type "SELECT name, category, price, stock FROM pro"
Sleep 300ms
Tab
Wait+Screen /COMPLETE/
Sleep 650ms
Enter
Type " p WHERE p.st"
Sleep 300ms
Tab
Wait+Screen /COMPLETE/
Sleep 650ms
Enter
Type " > 10 ORDER BY price DESC LIMIT 5"
Sleep 400ms
Enter
Wait+Screen /READ SELECT/
Sleep 2.3s

# 4 · A write, tagged as such.
Type "UPDATE products SET stock = stock - 4 WHERE id = 3"
Sleep 400ms
Enter
Wait+Screen /WRITE/
Sleep 1.8s

# 5 · Reverse-i-search recalls the first query; the stock change shows up.
Ctrl+R
Sleep 500ms
Type@110ms "stock >"
Sleep 900ms
Enter
Sleep 500ms
Enter
Wait+Screen /\| 11 /
Sleep 2.4s

# 6 · Query plan for that same query.
Type ".explain"
Sleep 300ms
Enter
Wait+Screen /PLAN/
Sleep 2.8s
