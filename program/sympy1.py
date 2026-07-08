import sympy

# 数式の展開
a = sympy.Symbol('a')
b = sympy.Symbol('b')
tenkai1 = sympy.expand((a+b)**2)
print(tenkai1)

# 数式の因数分解
x = sympy.Symbol('x')
y = sympy.Symbol('y')
bunkai1 = sympy.factor(x**2+3*x+2)
print(bunkai1)