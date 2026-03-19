/**
  En esta primera parte, vamos a:
  - Importar imagenes Landsat
  - Filtrar imagenes (ubicacion, fecha, propiedades)
  - Visualizar todas las imagenes de un ImageCollection
  - Ordenar un ImageCollection en base a una propiedad
  - Visualizar una imagen en distintas combinacion de bandas
  - Aplicar un map() a un ImageCollection
  - Aplicar un reduce() a un ImageCollection
  - Importar features collection (shapefiles)
  - Recortar una imagen en base a un feature
 */

// ---------------------------------------------------------------------------------------------------------------

// // Importamos el dataset Landsat8 
var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')

// // Map.addLayer(landsat)
// // print(landsat)


// Filtrando las imágenes Landsat
var collection = landsat.filterBounds(ee.Geometry.Point(-73.23, -3.80))
                        .filterDate('2024-01-01', '2024-06-30')
                        .filter(ee.Filter.lt('CLOUD_COVER', 50))
                        
Map.addLayer(collection)
print(collection)


// // Visualizando todas las imágenes de un ImageCollection
 
// collection.evaluate(function(list) {
//   list.features.forEach(function(f, i) {
//     var img = ee.Image(f.id);
//     Map.addLayer(img, {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 5000, max: 15000}, 'Imagen ' + i, false);
//   });
// });


// // Visualizando la imagen con menor nubosidad

// var image = ee.Image('LANDSAT/LC08/C02/T1_L2/LC08_006063_20240623')
// Map.addLayer(image, {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 5000, max: 15000}, 'Imagen con menor nubosidad', false)

// var image2 = landsat.filterBounds(ee.Geometry.Point(-73.23, -3.80))
//                         .filterDate('2024-01-01', '2024-06-30')
//                         .filter(ee.Filter.lt('CLOUD_COVER', 50))
//                         .sort('CLOUD_COVER')
//                         .first()
                        
// Map.addLayer(image2, {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 5000, max: 15000}, 'Imagen con menor nubosidad 2', false)


// // Aplicando factor de escala

function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

// var image3 = landsat.filterBounds(geometry)
//                         .filterDate('2024-01-01', '2024-06-30')
//                         .filter(ee.Filter.lt('CLOUD_COVER', 50))
//                         .sort('CLOUD_COVER')
//                         .map(applyScaleFactors)
//                         .first()

// Map.addLayer(image3, {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min:0, max: 0.4}, 'Imagen escalada 432', false)
// Map.addLayer(image3, {bands: ['SR_B6', 'SR_B5', 'SR_B4'], min:0, max: 0.4}, 'Imagen escalada 654', false)


// // Reduciendo imagenes

// var collection = landsat.filterBounds(geometry)
//                         .filterDate('2024-01-01', '2024-12-31')  // <- Ampliamos el umbral de fechas
//                         .filter(ee.Filter.lt('CLOUD_COVER', 70))  // <- Ampliamos el umbral de cloud cover
//                         .map(applyScaleFactors)
// print(collection.size())

// var median = collection.median()
// Map.addLayer(median, {bands: ['SR_B6', 'SR_B5', 'SR_B4'], min:0, max: 0.4}, 'Imagen median 654', false)

// var mean = collection.mean()
// Map.addLayer(mean, {bands: ['SR_B6', 'SR_B5', 'SR_B4'], min:0, max: 0.4}, 'Imagen mean 654', false)


// Revisando features collection

var provincias = ee.FeatureCollection('projects/ee-jromualdoibc/assets/limite_provincias')
Map.addLayer(provincias, {}, 'Provincias Perú')

var provincia = provincias.filter(ee.Filter.eq("NOMBPROV","SULLANA"))
Map.addLayer(provincia, {'color':'red'}, 'fc rojo', false)
Map.addLayer(provincia.style({fillColor: '00000001'}), {}, 'fc con borde negro', false)


// Recortando una imagen en base a una geometria

var geometry = ee.Geometry.Point([-80.5984660946807, -4.568980521218432]);

var image_provincia = landsat.filterBounds(geometry)
                        .filterDate('2024-01-01', '2024-12-31')  // <- Ampliamos el umbral de fechas
                        .filter(ee.Filter.lt('CLOUD_COVER', 70))  // <- Ampliamos el umbral de cloud cover
                        .map(applyScaleFactors)
                        .median()
                        
Map.addLayer(image_provincia, {bands: ['SR_B6', 'SR_B5', 'SR_B4'], min:0, max: 0.4}, 'Imagen provincia', false)

var image_clip = image_provincia.clip(provincia)
Map.addLayer(image_clip, {bands: ['SR_B6', 'SR_B5', 'SR_B4'], min:0, max: 0.4}, 'Imagen clip', false)

Export.image.toDrive({
  image: image_clip,
  description: 'imagen_sullana',
  folder: 'PRUEBA-GEE',
  region: provincia,
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
