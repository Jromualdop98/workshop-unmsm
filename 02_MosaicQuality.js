/**
  En esta primera parte, vamos a:
  - Elaborar mosaicos con menor nubosidad con la banda de calidad (BQA)
  - Elaborar mosaicos con menor nubosidad con la función CloudScore
  - Visualizar la diferencia entre ambos métodos
 */

// ---------------------------------------------------------------------------------------------------------------

// Creamos una funcion para filtrar y crear una imagen mediana

function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2).multiply(10000);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

var roi = ee.Geometry.Polygon(
        [[[-76.6741002209563, -9.310991550697223],
          [-76.6741002209563, -9.462740535235271],
          [-76.57762652710865, -9.462740535235271],
          [-76.57762652710865, -9.310991550697223]]], null, false);

var image_L8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                      .filterBounds(roi)
                      .filterDate('2024-01-01', '2024-12-31') 
                      .filter(ee.Filter.lt('CLOUD_COVER', 70)) 
                      .map(applyScaleFactors)
                      .median()
                      .clip(roi)

Map.addLayer(image_L8, {bands: ['SR_B6', 'SR_B5', 'SR_B4'], min: 0, max: 4000}, 'Imagen L8', false)


// Funcion de enmascaramiento en base a CloudScore
function cloudScore(image) {
  
  var rescale = function (obj) {
      var image = obj.image.subtract(obj.min).divide(ee.Number(obj.max).subtract(obj.min));
      return image;
  };
  
      var cloudThresh = 1;
      var score = ee.Image(1.0);
  
      score = score.min(rescale({
          'image': image.select(['SR_B2']),
          'min': 1000,
          'max': 3000
      }));
      score = score.min(rescale({
          'image': image.expression("b('SR_B4') + b('SR_B3') + b('SR_B2')"),
          'min': 2000,
          'max': 8000
      }));
      score = score.min(rescale({
          'image': image.expression("b('SR_B5') + b('SR_B6') + b('SR_B7')"),
          'min': 3000,
          'max': 8000
      }));
  
      var ndsi = image.normalizedDifference(['SR_B3', 'SR_B6']);
      score = score.min(rescale({
          'image': ndsi,
          'min': 0.8000,
          'max': 0.6000
      })).multiply(100).byte();
  
      var cond = score.lt(cloudThresh);
      return image.addBands(score).updateMask(cond);
  };
  
var image_L8_CS = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                      .filterBounds(roi)
                      .filterDate('2024-01-01', '2024-12-31') 
                      .filter(ee.Filter.lt('CLOUD_COVER', 70)) 
                      .map(applyScaleFactors)
                      .map(cloudScore)  // <- 
                      .median()
                      .clip(roi)

Map.addLayer(image_L8_CS, {bands: ['SR_B6', 'SR_B5', 'SR_B4'], min: 0, max: 4000}, 'Imagen L8 CS', false)


// Funcion de enmascaramiento en base a la banda de calidad

function maskQA(image) {
  
  // Bits 3 and 4 are cloud shadow and cloud, respectively.
  var cloudShadowBitMask = 1 << 3;
  var cloudsBitMask = 1 << 4;

  var qa = image.select('QA_PIXEL');

  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
      .and(qa.bitwiseAnd(cloudsBitMask).eq(0));

  return image.updateMask(mask)
      .copyProperties(image, ["system:time_start"]);
}

var image_L8_QA = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                      .filterBounds(roi)
                      .filterDate('2024-01-01', '2024-12-31') 
                      .filter(ee.Filter.lt('CLOUD_COVER', 70)) 
                      .map(applyScaleFactors)
                      .map(maskQA)  // <-
                      .median()
                      .clip(roi)

Map.addLayer(image_L8_QA, {bands: ['SR_B6', 'SR_B5', 'SR_B4'], min: 0, max: 4000}, 'Imagen L8 QA', false)