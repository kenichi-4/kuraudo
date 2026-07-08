import sympy
print(sympy.gcdex(71,11))

def modinv(a, m):
   x, y, g = sympy.gcdex(a, m)
   if g != 1:
      raise Exception('modular inverse does not exist')
   else:
      return x % m #最小正剰余で返す

print(modinv(11,71))