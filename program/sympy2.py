from sympy import Symbol, expand, factor

# 数式の展開
a = Symbol('a')
b = Symbol('b')
tenkai1 = expand((a+b)**2)
print(tenkai1)

# 数式の因数分解
x = Symbol('x')
y = Symbol('y')
bunkai1 = factor(x**2+3*x+2)
print(bunkai1)