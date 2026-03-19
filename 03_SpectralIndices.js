/**
  En esta parte, vamos a:
  - Generar el NDWI a una imagen Landsat 5-8
  - Ver el histograma de valores de NDWI para escoger un umbral adecuado
  - Enmascarar los cuerpos de agua
  - Probar otros indices espectrales (MNDWI, NDMI)
  - Evidenciar errores en la correccion atmosferica de Landsat 8
 */

// ---------------------------------------------------------------------------------------------------------------

// Recortando una imagen en base a una geometria

function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2).multiply(10000);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

function maskQA(image) {
  
  var cloudShadowBitMask = 1 << 3;
  var cloudsBitMask = 1 << 4;

  var qa = image.select('QA_PIXEL');

  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
      .and(qa.bitwiseAnd(cloudsBitMask).eq(0));

  return image.updateMask(mask)
      .copyProperties(image, ["system:time_start"]);
}

function filtradoIC(collection, roi, year, cloud_cover, scale){
  
  var col = collection.filterBounds(roi)   //geometry
                      .filterDate(year + '-01-01', year +'-12-31') 
                      .filter(ee.Filter.lt('CLOUD_COVER', cloud_cover)) 
                      .map(applyScaleFactors)
                      .map(maskQA)
                      .median()
                      .clip(roi)

  return col
}

var amazonia = ee.Geometry.Polygon(
        [[[-73.37402891457462, -3.598084268406182],
          [-73.37402891457462, -4.011903044983308],
          [-73.03619932473087, -4.011903044983308],
          [-73.03619932473087, -3.598084268406182]]], null, false);

var andes = ee.Geometry.Polygon(
        [[[-77.57090367160895, -7.519686656614797],
          [-77.57090367160895, -7.674187019466175],
          [-77.46447361789801, -7.674187019466175],
          [-77.46447361789801, -7.519686656614797]]], null, false);

          
// Probando NDWI con Landsat 5

var roi = andes
Map.centerObject(roi,10)

var L5 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')

var image_L5 = filtradoIC(L5, roi, 2000, 70, true)
Map.addLayer(image_L5, {bands: ['SR_B5', 'SR_B4', 'SR_B3'], min:0, max: 4000}, 'Imagen L5', false)


// Calculando el NDWI (McFeeters)

var ndwiL5 = image_L5.normalizedDifference(['SR_B2', 'SR_B4']).rename('NDWI')//.add(1).multiply(10000)
var ndwi_palette = ["#000180", "#0075FD", "#6CFB93", "#F99D05", "#A70700"]
var parViz_ndwi = {'min':-0.5,'max':0.3,'palette':ndwi_palette}
var parViz_ndmi = {'min':0.2,'max':0.8,'palette':ndwi_palette}
Map.addLayer(ndwiL5, parViz_ndwi, 'NDWI L5', false);


// Crear histograma de NDWI (método del valle)

var histogram = ui.Chart.image.histogram({
  image: ndwiL5,
  region: roi,
  scale: 30,
  maxBuckets: 256
}).setOptions({
  title: 'Histograma de NDWI',
  hAxis: {title: 'NDWI'},
  vAxis: {title: 'Frecuencia'},
  colors: ['#1f78b4']
});

print(histogram);


// Enmascarando los pixeles de agua

var water_maskL5 = ndwiL5.gte(-0.1)
Map.addLayer(water_maskL5, {}, 'Mascara NDWI L5', false)

var ndwiMaskedL5 = ndwiL5.updateMask(water_maskL5)
Map.addLayer(ndwiMaskedL5, {'palette':'blue'}, 'Cuerpos de agua NDWI L5', false)


// MNDWI (Xu, 2006)
var mndwiL5 = image_L5.normalizedDifference(['SR_B2', 'SR_B5']).rename(['mndwi']); 
Map.addLayer(mndwiL5, parViz_ndwi, 'MNDWI L5', false);

var mndwiMaskedL5 = mndwiL5.gte(0.4).selfMask()
Map.addLayer(mndwiMaskedL5, {'palette':'blue'}, 'Cuerpos de agua MNDWI L5', false)


// NDMI (Gao, 1996)
var ndmiL5 = image_L5.normalizedDifference(['SR_B4', 'SR_B5']).rename(['ndmi']); 
Map.addLayer(ndmiL5, parViz_ndmi, 'NDMI L5', false);

var ndmiMaskedL5 = ndmiL5.gte(0.5).selfMask()
Map.addLayer(ndmiMaskedL5, {'palette':'blue'}, 'Cuerpos de agua NDMI L5', false)


// Probando NDWI con Landsat 8

var L8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')

var image_L8 = filtradoIC(L8, roi, 2023, 70, true)
Map.addLayer(image_L8, {bands: ['SR_B6', 'SR_B5', 'SR_B4'], min:0, max: 4000}, 'Imagen L8', false)


// NDWI
var ndwiL8 = image_L8.normalizedDifference(['SR_B3', 'SR_B5']).rename('NDWI')//.add(1).multiply(10000)
Map.addLayer(ndwiL8, parViz_ndwi, 'NDWI L8', false);

var ndwiMaskedL8 = ndwiL8.gte(-0.1).selfMask()
Map.addLayer(ndwiMaskedL8, {'palette':'blue'}, 'Cuerpos de agua NDWI L8', false)


// MNDWI
var mndwiL8 = image_L8.normalizedDifference(['SR_B3', 'SR_B6']).rename(['mndwi']); 
Map.addLayer(mndwiL8, parViz_ndwi, 'MNDWI L8', false);

var mndwiMaskedL8 = mndwiL8.gte(0.4).selfMask()
Map.addLayer(mndwiMaskedL8, {'palette':'blue'}, 'Cuerpos de agua MNDWI L8', false)


// NDMI
var ndmiL8 = image_L8.normalizedDifference(['SR_B5', 'SR_B6']).rename(['ndmi']); 
Map.addLayer(ndmiL8, parViz_ndmi, 'NDMI L8', false);

var ndmiMaskedL8 = ndmiL8.gte(0.5).selfMask()
Map.addLayer(ndmiMaskedL8, {'palette':'blue'}, 'Cuerpos de agua NDMI L8', false)


// Probando con Landsat 8 TOA

var L8_TOA = ee.ImageCollection("LANDSAT/LC08/C02/T1_TOA")
var image_L8_TOA = filtradoIC(L8_TOA, roi, 2023, 70, false).multiply(10000)
Map.addLayer(image_L8_TOA, {bands: ['B6', 'B5', 'B4'], min:0, max: 4000}, 'Imagen L8 TOA', false)

var ndwiL8_TOA = image_L8_TOA.normalizedDifference(['B3', 'B5']).rename('NDWI')//.add(1).multiply(10000)
Map.addLayer(ndwiL8_TOA, parViz_ndwi, 'NDWI L8 TOA', false);


// function filtradoIC(collection, roi, year, cloud_cover, scale){
  
//   var col = collection.filterBounds(roi)   //geometry
//                       .filterDate(year + '-01-01', year +'-12-31') 
//                       .filter(ee.Filter.lt('CLOUD_COVER', cloud_cover)) 
  
//   var col2;
  
//   if (scale){
//     col2 =col.map(applyScaleFactors)
//             .map(maskQA)
//             .median()
//             .clip(roi)
//   }
  
//   else {
//     col2 =col.map(maskQA)
//             .median()
//             .clip(roi)
//   }

  
//   return col2
// }


