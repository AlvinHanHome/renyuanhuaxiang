import io
p = r"D:/！！！工作/7.数创大赛/市局/发展党员/发展党员人员画像-配色改版/assets/js/app.js"
s = io.open(p, encoding="utf-8").read()
reps = [
    ("#FFF7EC", "#3A1418"),
    ("#FFE7A8", "#8A6A52"),
    ("#F2D2A6", "#8A6A52"),
    ("rgba(255,209,102,.35)", "rgba(200,22,29,.30)"),
    ("rgba(255,209,102,.4)", "rgba(200,22,29,.35)"),
    ("rgba(255,209,102,.22)", "rgba(200,22,29,.18)"),
    ("rgba(255,209,102,.25)", "rgba(200,22,29,.20)"),
    ("rgba(255,90,60,.04)", "rgba(200,22,29,.03)"),
]
for a,b in reps:
    n = s.count(a)
    s = s.replace(a,b)
    print("%-28s -> %-22s x%d" % (a,b,n))
io.open(p,"w",encoding="utf-8").write(s)
print("DONE")
