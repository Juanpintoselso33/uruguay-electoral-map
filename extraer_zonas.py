import pandas as pd
import unicodedata

# Función para normalizar cadenas
def normalizar_cadena(cadena):
    if isinstance(cadena, str):
        # Normalize Unicode characters
        cadena = unicodedata.normalize('NFKD', cadena)
        # Remove non-ASCII characters (keeping only letters, numbers, and spaces)
        cadena = ''.join(c for c in cadena if ord(c) < 128)
        return " ".join(cadena.strip().upper().split())
    return cadena

# Cargar el archivo CSV
file_path = './public/ODD PN POR SERIE MONTEVIDEO (1).csv'  # Reemplaza con la ruta de tu archivo
df = pd.read_csv(file_path, delimiter=';', quoting=3, encoding='utf-8')

# Extraer las zonas únicas y normalizarlas
zonas_unicas = df['ZONA'].dropna().unique()
zonas_normalizadas = sorted(set(normalizar_cadena(zona) for zona in zonas_unicas))

# Guardar las zonas únicas normalizadas en un archivo de texto
with open('zonas_unicas.txt', 'w', encoding='utf-8') as file:
    for zona in zonas_normalizadas:
        file.write(f"{zona}\n")

print("Las zonas únicas han sido extraídas y guardadas en 'zonas_unicas.txt'.")