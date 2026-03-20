/**
  En esta parte, vamos a:
  - Identificar cuerpos de agua basados en una metodología que involucra endmembers y probabilidades.
  - Hacer una comparación entre la detección con NDWI
 */

// ---------------------------------------------------------------------------------------------------------------

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
 
      
function sma(image) {

      var endmembers = [
            [119.0, 475.0, 169.0, 6250.0, 2399.0, 675.0], /*gv*/
            [1514.0, 1597.0, 1421.0, 3053.0, 7707.0, 1975.0], /*npv*/
            [1799.0, 2479.0, 3158.0, 5437.0, 7707.0, 6646.0], /*soil*/
            [4031.0, 8714.0, 7900.0, 8989.0, 7002.0, 6607.0] /*cloud*/
          ];
          
      var outBandNames = ['gv', 'npv', 'soil', 'cloud'];
      
      var fractions = ee.Image(image)
          .select(bandnamed)
          .unmix(endmembers)
          .max(0)
          .multiply(100)
          .byte();
      
      fractions = fractions.rename(outBandNames);
      
      var summed = fractions.expression('b("gv") + b("npv") + b("soil")');
      
      var shade = summed
          .subtract(100)
          .abs()
          .byte()
          .rename("shade");
      
      fractions = fractions.addBands(shade);
      
      return image.addBands(fractions);
}

var bandnamed = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'];
var bands_l8 = ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'];

function renameBands(imgCol, input) {
    return imgCol.select(input, bandnamed);
  };      
      
      
function filtradoIC(collection, roi, year, cloud_cover, scale){
  
  var col = collection.filterBounds(roi)   //geometry
                      .filterDate(year + '-01-01', year +'-12-31') 
                      .filter(ee.Filter.lt('CLOUD_COVER', cloud_cover)) 
                      .map(applyScaleFactors)
                      .map(maskQA)
                      
  var col2 = renameBands(col, bands_l8)                   
    
  col2 = col2.map(sma)
             .median()
             .clip(roi)

  return col2
}

var roi = ee.Geometry.Polygon(
        [[[-73.36580250001803, -3.574179555847684],
          [-73.36580250001803, -4.041436696755864],
          [-73.0279729101743, -4.041436696755864],
          [-73.0279729101743, -3.574179555847684]]], null, false);


// Probando NDWI con Landsat 8

var L8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')  //LANDSAT/LC08/C02/T1_L2

var image_L8 = filtradoIC(L8, roi, 2023, 70, true)
Map.addLayer(image_L8, {bands: ['swir1', 'nir', 'red'], min:0, max: 4000}, 'Imagen L8', false)

// NDWI
var ndwi_palette = ["#000180", "#0075FD", "#6CFB93", "#F99D05", "#A70700"]
var parViz_ndwi = {'min':-0.5,'max':0.3,'palette':ndwi_palette}

var ndwiL8 = image_L8.normalizedDifference(['green', 'nir']).rename('NDWI')//.add(1).multiply(10000)
Map.addLayer(ndwiL8, parViz_ndwi, 'NDWI L8', false);

var ndwiMaskedL8 = ndwiL8.gte(-0.1).selfMask()
Map.addLayer(ndwiMaskedL8, {'palette':'blue'}, 'Cuerpos de agua NDWI L8', false)


// Utilizando umbrales para generar raster de probabilidad basados en endmembers

var shade_min = 65; 
var shade_max = 75;

var gv_soil_min = 0;   //5
var gv_soil_max = 10;   //15

var cloud_asc_min = 0;
var cloud_asc_max = 8;   //5

var cloud_desc_min = 25; 
var cloud_desc_max = 35;


var shade_Fit = ee.Dictionary(ee.List([[shade_min,0],[shade_max,1]]).reduce(ee.Reducer.linearFit()));
var gv_soil_Fit = ee.Dictionary(ee.List([[gv_soil_min,1],[gv_soil_max,0]]).reduce(ee.Reducer.linearFit()));
var cloud_asc_Fit = ee.Dictionary(ee.List([[cloud_asc_min,0],[cloud_asc_max,1]]).reduce(ee.Reducer.linearFit()));
var cloud_desc_Fit = ee.Dictionary(ee.List([[cloud_desc_min,1],[cloud_desc_max,0]]).reduce(ee.Reducer.linearFit()));

var class_1_probs = function (image) {
    
    var gv_soil = image.select('gv').addBands(image.select('soil')).reduce(ee.Reducer.sum());
    
    var cond_1 = image.select('shade').multiply(shade_Fit.getNumber('scale')).add(shade_Fit.getNumber('offset')).clamp(0, 1);
    var cond_2 = gv_soil.multiply(ee.Number(gv_soil_Fit.get('scale'))).add(ee.Number(gv_soil_Fit.get('offset'))).clamp(0, 1);
    var cond_3 = image.select('cloud').multiply(cloud_desc_Fit.getNumber('scale')).add(cloud_desc_Fit.getNumber('offset')).clamp(0, 1)
                  .addBands(
                  image.select('cloud').multiply(cloud_asc_Fit.getNumber('scale')).add(cloud_asc_Fit.getNumber('offset')).clamp(0, 1)  
                  ).reduce(ee.Reducer.min());
    
    var image_prob = cond_1.addBands(cond_2).addBands(cond_3).reduce(ee.Reducer.mean());
    
    //image_prob = image_prob.where(image.select('soil').gt(10),0)
    
    return image_prob;
};

var raster_prob = class_1_probs(image_L8)
Map.addLayer(raster_prob,{"min":0,"max":0.8,"palette":['ff451b','ffc218','fff80c','08ffe8','042eff'] },'Probabilidad')

var water = raster_prob.gte(0.65).selfMask()
Map.addLayer(water, {'palette':'blue'}, 'Cuerpos de agua ENDMEMBERS')