import pandas as pd

# Función para normalizar cadenas
def normalizar_cadena(cadena):
    if isinstance(cadena, str):
        return " ".join(cadena.strip().upper().split())
    return str(cadena)  # Convert non-string values to string

# Diccionario con mapeo manual actualizado
ajustes_manual = {
    "PLAZA INDEPENDENCIA (NORTE, RAMBLA PORTU)": "Ciudad Vieja",
    "CENTRO ( 18 DE JULIO Y CONSTITUYENTE)": "Centro",
    "CENTRO (18 DE JULIO Y CONSTITUYENTE)": "Centro",
    "MONUMENTO LA BANDERA ( NORTE - ADY)": "Tres Cruces",
    "BLANQUEADA": "La Blanqueada",
    "POCITOS NUEVO - TROUVILLE": "Pocitos",
    "TROUVILLE - VILLA BIARRITZ": "Punta Carretas",
    "PARQUE BATLLE AL SUR - TRES CRUCES": "Parque Batlle, Villa Dolores",
    "POCITOS ( ZONA PLAYA)": "Pocitos",
    "PARQ PEREIRA ROSSELL - POCITOS - PUERTO": "Pocitos",
    "PARQ BATLLE - VILLA DOLORES - BUCEO": "Parque Batlle, Villa Dolores",
    "PÉREZ CASTELLANOS - CILINDRO - VILLA ESP": "Castro, P. Castellanos",
    "PEREZ CASTELLANO": "Castro, P. Castellanos",
    "BUCEO - MALVÍN NUEVO": "Buceo",
    "UNIÓN - MALVÍN NORTE - PARQ RIVERA": "Unión",
    "MALVÍN - PUNTA GORDA": "Malvín",
    "CARRASCO NORTE - CARRASCO": "Carrasco Norte",
    "UNIÓN Y BLANQUEADA": "Unión",
    "CARRASCO Y CARRASCO NORTE": "Carrasco",
    "MALVIN NORTE": "Malvín Norte",
    "ITUZAINGÓ Y MAROÑAS": "Ituzaingó",
    "FLOR DE MAROÑAS - MAROÑAS - IDEAL- LAS C": "Flor de Maroñas",
    "VILLA GARCÍA - PARQ MARCOS SASTRE - PUNT": "Villa García, Manga Rural",
    "TOLEDO CHICO - BOLA DE NIEVE": "Manga, Toledo Chico",
    "BELLA ITALIA JARDINES DEL HIPODROMO Y PI": "Bella Italia",
    "PALACIO LEGISLATIVO AL SUR": "Aguada",
    "PALACIO LEGISLATIVO AL SUR- EST ARTIGAS": "Aguada",
    "EST ARTIGAS AL NORTE Y PALACIO LEGISLATI": "Aguada",
    "PALACIO LEGISLATIVO": "Aguada",
    "PALACIO LEGISLATIVO AL NORTE": "Aguada",
    "REDUCTO AL SUR": "Reducto",
    "VILLA MUÑOZ": "Villa Muñoz, Retiro",
    "VILLA MUÑOZ AL SUR (RETIRO)": "Villa Muñoz, Retiro",
    "RETIRO": "Villa Muñoz, Retiro",
    "BOLIVAR- JACINTO VERA": "Jacinto Vera",
    "ATAHUALPA - FIGURITA": "Atahualpa",
    "FIGURITA": "La Figurita",
    "BRAZO ORIENTAL Y PARQUE POSADA": "Brazo Oriental",
    "MARCONI - CERRITO": "Cerrito",
    "JOANICÓ - CERRITO": "Cerrito",
    "BOIZO LANZA - CASAVALLE": "Casavalle",
    "MENDOZA - MANGA - PIEDRAS BLANCAS": "Manga",
    "CAPURRO - BELLA VISTA": "Capurro, Bella Vista",
    "19 DE ABRIL - BELLA VISTA Y ARROYO SECO": "Capurro, Bella Vista",
    "PRADO - 19 DE ABRIL": "Prado, Nueva Savona",
    "19 DE ABRIL Y REDUCTO": "Reducto",
    "RINC MELILLA- MELILLA - AERODR ADAMI - L": "Lezica, Melilla",
    "ABAYUBÁ - COLONIA SAINT BOIS - COLÓN - F": "Colón Sureste, Abayubá",
    "CAM. DE LA TROPAS . LIMITE DEPARTAMENTAL": "Manga, Toledo Chico",
    "VILLA DEL CERRO (ZONA DE LA PLAYA)": "Cerro",
    "VILLA DEL CERRO": "Cerro",
    "RINCÓN DEL CERRO - CERRO NORTE - LA PALO": "Cerro",
    "CASABÓ - VILLA DEL CERRO": "Casabó, Pajas Blancas",
    "PAJAS BLANCAS": "Casabó, Pajas Blancas",
    "SANTA CATALINA": "Casabó, Pajas Blancas",
    "LA TEJA - BELVEDERE": "La Teja",
    "BELVEDERE - PUEBLO VICTORIA": "Belvedere",
    "NUEVO PARÍS - CAMINO DE LAS TROPAS Y LUI": "Nuevo París",
    "PLAYA LA COLORADA (PAJAS BLANCAS AL NOR)": "Casabó, Pajas Blancas",
    "SANTIAGO VÁZQUEZ- LOS BOULEVARÉS - PASO": "Paso de la Arena",
    "SANTIAGO VAZQUEZ": "Paso de la Arena",
    "CONCILIACIÓN - EST SAYAGO": "Sayago",
    "PUEBLO FERROCARRIL- EST PEÑAROL": "Peñarol, Lavalleja",
    "PEÑAROL - QUINTA DE SANTOS - SAYAGO - QU": "Peñarol, Lavalleja",
    "ADUANA ( GURUYÚ)": "Ciudad Vieja",
    "AGUADA": "Aguada",
    "ATAHUALPA - FIGURITA": "Atahualpa",
    "BARRIO PALERMO (ZONA SUR)": "Palermo",
    "BARRIO SUR (SUR)": "Barrio Sur",
    "BELVEDERE": "Belvedere",
    "CENTRO (NORTE DE 18 DE JULIO)": "Centro",
    "CENTRO - MONUMENTO EL GAUCHO - CEMENT. C": "Centro",
    "CENTRO - NORTE DE 18 DE JULIO": "Centro",
    "CENTRO - PLAZA INDEPENDENCIA": "Centro",
    "CENTRO - SUR DE 18 DE JULIO": "Centro",
    "CENTRO- NORTE DE 18 DE JULIO": "Centro",
    "CORDÓN": "Cordón",
    "CORDÓN NORTE": "Cordón",
    "CORDÓN NORTE - MONUMENTO LA BANDERA": "Cordón",
    "CORDÓN NORTE Y ADY. 18 DE JULIO": "Cordón",
    "GURUYÚ (ZONA SUR)": "Ciudad Vieja",
    "LARRAÑAGA": "Larrañaga",
    "MONUMENTO LA BANDERA ( NORTE - ADY)": "Tres Cruces",
    "PARQUE RODÓ": "Parque Rodó",
    "PIEDRAS BLANCAS": "Piedras Blancas",
    "ZONA DE LA RAMBLA Y BARRIO SUR (SUR)": "Barrio Sur"
}

# Cargar el archivo CSV con el delimitador correcto
file_path = './public/ODD PN POR SERIE MONTEVIDEO (1).csv'
df = pd.read_csv(file_path, delimiter=';', quoting=3)

# Aplicar normalización y mapeo
df['ZONA'] = df['ZONA'].apply(lambda zona: ajustes_manual.get(normalizar_cadena(zona), zona))

# Guardar el resultado en un nuevo archivo CSV
output_path = './public/votos_por_barrio_pn_mapeado.csv'
df.to_csv(output_path, index=False, sep=';')

print("El mapeo de zonas se ha completado correctamente.")
