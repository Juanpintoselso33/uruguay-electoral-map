import json

# Diccionario de nombres de barrios
barrios = {
    1: "Ciudad Vieja",
    2: "Centro",
    3: "Barrio Sur",
    4: "Cordón",
    5: "Palermo",
    6: "Parque Rodó",
    7: "Punta Carretas",
    8: "Pocitos",
    9: "Buceo",
    10: "Parque Batlle, Villa Dolores",
    11: "Malvín",
    12: "Malvín Norte",
    13: "Punta Gorda",
    14: "Carrasco",
    15: "Carrasco Norte",
    16: "Bañados de Carrasco",
    17: "Maroñas, Parque Guaraní",
    18: "Flor de Maroñas",
    19: "Las Canteras",
    20: "Punta Rieles, Bella Italia",
    21: "Jardines del Hipódromo",
    22: "Ituzaingó",
    23: "Unión",
    24: "Villa Española",
    25: "Mercado Modelo, Bolívar",
    26: "Castro, P. Castellanos",
    27: "Cerrito",
    28: "Las Acacias",
    29: "Aires Puros",
    30: "Casavalle",
    31: "Piedras Blancas",
    32: "Manga, Toledo Chico",
    33: "Paso de las Duranas",
    34: "Peñarol, Lavalleja",
    35: "Cerro",
    36: "Casabó, Pajas Blancas",
    37: "La Paloma, Tomkinson",
    38: "La Teja",
    39: "Prado, Nueva Savona",
    40: "Capurro, Bella Vista",
    41: "Aguada",
    42: "Reducto",
    43: "Atahualpa",
    44: "Jacinto Vera",
    45: "La Figurita",
    46: "Larrañaga",
    47: "La Blanqueada",
    48: "Villa Muñoz, Retiro",
    49: "La Comercial",
    50: "Tres Cruces",
    51: "Brazo Oriental",
    52: "Sayago",
    53: "Conciliación",
    54: "Belvedere",
    55: "Nuevo París",
    56: "Tres Ombúes, Victoria",
    57: "Paso de la Arena",
    58: "Colón Sureste, Abayubá",
    59: "Colón Centro y Noroeste",
    60: "Lezica, Melilla",
    61: "Villa García, Manga Rural",
    62: "Manga"
}

# Cargar el archivo JSON
try:
    with open('./public/v_sig_barrios.json', 'r', encoding='utf-8') as file:
        data = json.load(file)
except FileNotFoundError:
    print("El archivo 'v_sig_barrios.json' no se encuentra en la ruta especificada.")
    exit(1)

# Actualizar los nombres de los barrios
for feature in data['features']:
    if 'NROBARRIO' in feature['properties']:
        barrio_id = feature['properties']['NROBARRIO']
        if barrio_id in barrios:
            feature['properties']['BARRIO'] = barrios[barrio_id]
    else:
        print(f"La clave 'NROBARRIO' no se encuentra en las propiedades de la característica: {feature}")

# Guardar el archivo JSON actualizado
with open('./public/v_sig_barrios.json', 'w', encoding='utf-8') as file:
    json.dump(data, file, ensure_ascii=False, indent=2)