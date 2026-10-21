import json, csv
from pathlib import Path
p=Path(__file__).resolve().parent.parent/'site'/'data'
p.mkdir(exist_ok=True)
sources=[]
def source(id,title,url,scope,status,notes):
 sources.append(dict(id=id,title=title,url=url,scope=scope,status=status,notes=notes,accessed='2026-10-20'))
source('heat25','AFHSD · Heat illness, 2021–2025 · Table 3','https://www.health.mil/Reference-Center/Reports/2026/05/01/MSMR-Article-1-Table-3','Military · worldwide','Extracted','21 named locations; one heat illness per person per year; location of diagnosis/report. Other locations retained separately.')
source('heat24','AFHSD · Heat illness, 2020–2024 · Table 3','https://www.health.mil/Reference-Center/Reports/2025/06/01/MSMR-Article-1-Table-3','Military · worldwide','Extracted','22 named locations. Overlaps the newer five-year window; do not add windows or infer annual changes from their difference.')
source('heatfull','MSMR · May 2026 full issue','https://health.mil/Reference-Center/Reports/2026/05/01/MSMR-Vol-33-No-5-May-2026','Military · trends and methods','Extracted','Table 2 branch-year counts/rates extracted. PDF tables preferred over erroneous web chart alt text. Includes Coast Guard; Space Force separate from 2023.')
source('cold25','AFHSD · Cold injury, July 2020–June 2025','https://health.mil/Reference-Center/Reports/2025/12/01/MSMR-Vol-32-No-12-Dec-2025','Military · worldwide','Extracted','Figure 4 names 23 locations with ≥25 cases over five seasons. Exact five-season totals are stated for five locations only in the narrative; other totals remain null. Scope includes unspecified cold injuries.')
source('congress','DoD · Heat Illness Report to Congress · November 2023','https://health.mil/Reference-Center/Reports/2023/11/28/Heat-Illness-Report','Military · surveillance gaps and WBGT','Reviewed','2018–2022: 11,218 diagnoses at >230 locations. Missing DRSi reports are not the same as diagnoses absent from all surveillance. Appendix C contains modeled flag-day histories at 15 training locations.')
source('monthly','DCPH-A · Weather-related injury surveillance archive','https://ph.health.mil/news/Pages/PublicationDetails.aspx?type=Weather-Related+Injury+Surveillance','Military · monthly reports','Catalogued','Additional installation charts and provisional year-to-date series; not merged into annual MSMR counts.')
source('apr26','DCPH-A · April 2026 heat surveillance summary','https://ph.health.mil/periodicals/ppub-heat-injury-report-apr2026.pdf','Military · provisional 2026','Retrieval incomplete','Indexed report identified; PDF retrieval returned 502. No numeric rows imported. Installation chart excludes counts below 10.')
source('japan','Japan FDMA · Heat illness ambulance transports, 2025','https://www.fdma.go.jp/disaster/heatstroke/items/r7/heatstroke_nenpou_r7.pdf','Civilian · 47 prefectures','Extracted','May 1–September 30, 2025. Table 4-2, PDF page 10. Ambulance transports for heat illness, not a count of severe heat stroke; prefecture capital coordinates are display anchors.')
source('india','India NCRB / Ministry of Earth Sciences · Recorded heat/sunstroke deaths','https://www.pib.gov.in/PressReleasePage.aspx?PRID=2158403&lang=2&reg=3','Civilian · 28 states, 2018–2022','Extracted','Annexure 1, August 20, 2025 parliamentary response. State rows extracted; union territories excluded from map. Zero means zero recorded deaths, not proof of no heat mortality.')
source('maricopa','Maricopa County · 2025 heat-related deaths report','https://www.maricopa.gov/ArchiveCenter/ViewFile/Item/6510','Civilian · Arizona','Extracted','Table A: 2021–2025 deaths including heat-caused and heat-contributed deaths; includes nonresidents. County anchor, not individual death locations.')
source('spain','Spain Ministry of Health · 2025 summer assessment','https://www.sanidad.gob.es/gabinete/notasPrensa.do?id=6760','Civilian · Spain','Extracted','May 16–September 30, 2025. 25 confirmed heat-stroke deaths and 3,832 MoMo modeled heat-attributable deaths are distinct measures, not an underreporting ratio.')
source('france','Santé publique France · Summer 2025 bulletin','https://www.santepubliquefrance.fr/sites/default/files/rdd/document/bullnat_chaleur_bilan_2025.pdf','Civilian · Metropolitan France','Reviewed','June 1–September 15, 2025: >5,700 modeled heat-attributable deaths and >24,000 iCanicule urgent-care contacts (hyperthermia, dehydration, hyponatremia). Not added as exact map counts.')
source('cdc','CDC Tracking · Heat and heat-related illness','https://www.cdc.gov/environmental-health-tracking/php/data-research/heat-heat-related-illness.html','Civilian · United States','Catalogued','ED visits, hospitalizations and death-certificate mortality. County coverage, suppression, denominators and available years depend on indicator. Nationwide extract not yet imported.')
source('cdcmap','CDC · Heat & Health Tracker','https://ephtracking.cdc.gov/Applications/heatTracker/','Civilian · United States','External explorer','Heat exposure, health outcomes, and vulnerability are distinct layers. Follow source links to query its current data.')
source('florida','Florida Environmental Public Health Tracking','https://www.floridatracking.com/healthtracking/mapview.htm','Civilian · Florida','Catalogued','Heat-related events with geographic identifiers. Suppressed and unavailable cells must remain missing; data not imported.')
source('coldcivil','EPA · Cold-related deaths technical documentation','https://www.epa.gov/sites/production/files/2021-04/documents/cold-deaths_td.pdf','Civilian · United States','Catalogued','Mortality methods and CDC WONDER provenance; civilian cold outcome data not yet extracted.')
source('nasa','NASA GIBS · Open geospatial imagery services','https://nasa-gibs.github.io/gibs-api-docs/access-basics/','Environmental exposure · worldwide','External explorer','Satellite land-surface temperature is not ambient air temperature, WBGT, or illness incidence. No environmental surface is inferred from case counts.')
source('wbgt','US Army · TB MED 507 · Heat stress control','https://www.govinfo.gov/content/pkg/GOVPUB-D101-PURL-gpo216616/pdf/GOVPUB-D101-PURL-gpo216616.pdf','Prevention · heat','Reference','Primary military heat-stress guidance. Atlas is retrospective and does not replace local WBGT measurements or operational guidance.')
source('coldguide','US Army · TB MED 508 · Cold-weather injury prevention','https://apps.dtic.mil/sti/tr/pdf/ADA433435.pdf','Prevention · cold','Reference','Primary cold-weather guidance cited by the AFHSD surveillance report.')
source('navy','Navy · Prevention and treatment of heat and cold stress injuries','https://www.med.navy.mil/portals/62/documents/nmfa/nmcphc/root/occupational%20and%20environmental%20medicine/5heat_and_cold_final_june07.pdf','Prevention · Navy','Reference','2007 technical manual cited by 2026 MSMR. Retain publication date; not represented as newly issued guidance.')
source('rhabdo','AFHSD · Exertional rhabdomyolysis, 2021–2025','https://health.mil/News/Articles/2026/05/01/MSMR-Rhabdomyolysis-2026','Related military outcome','Catalogued','Keep separate from heat exhaustion/heat stroke; co-occurrence precludes simply adding counts.')
source('hypo','AFHSD · Exertional hyponatremia, 2021–2025','https://health.mil/News/Articles/2026/05/01/MSMR-Hyponatremia-2026','Related military outcome','Catalogued','Distinct outcome; not treated as another heat illness case in this atlas.')

records=[]
def add(layer,name,count,lat,lon,period,src,region,measure='Heat illness cases',note='',lower=None):
 records.append(dict(id=f'r{len(records)+1}',layer=layer,name=name,count=count,lower_bound=lower,lat=lat,lon=lon,period=period,source=src,region=region,measure=measure,geocoding='Approximate display anchor; not an event coordinate',note=note))
locations=[
('Fort Benning, GA',32.36,-84.95,1737,1839),('Fort Bragg, NC',35.14,-79.00,942,833),('MCB Camp Lejeune / Cherry Point, NC',34.80,-77.10,829,894),('JB San Antonio, TX',29.42,-98.62,751,656),('MCRD Parris Island / Beaufort, SC',32.35,-80.69,679,642),('Fort Campbell, KY',36.66,-87.46,640,606),('Fort Polk, LA',31.05,-93.21,533,475),('MCRD San Diego / NB San Diego, CA',32.71,-117.17,485,473),('Fort Hood, TX',31.13,-97.78,452,425),('Okinawa, Japan',26.50,127.95,409,344),('Fort Jackson, SC',34.04,-80.87,328,318),('MCB Quantico, VA',38.52,-77.31,316,330),('MCB Camp Pendleton, CA',33.30,-117.35,313,333),('Fort Sill, OK',34.65,-98.40,290,287),('Fort Stewart, GA',31.87,-81.61,180,155),('Fort Shafter, HI',21.34,-157.89,177,159),('Twentynine Palms, CA',34.23,-116.05,177,183),('Fort Irwin, CA',35.26,-116.68,175,197),('Fort Leonard Wood, MO',37.76,-92.13,162,139),('NAS Pensacola, FL',30.35,-87.29,137,105),('Fort Bliss, TX',31.81,-106.42,127,128),('NSA Annapolis, MD',38.98,-76.48,None,103)]
for name,lat,lon,new,old in locations:
 region='Overseas' if 'Japan' in name else 'Alaska / Hawaii' if ', HI' in name else 'CONUS'
 note='One case per person per year; five-year cumulative count at diagnosis/report location. No installation population denominator.'
 if '/' in name or 'Okinawa' in name or 'JB ' in name: note+=' Combined reporting area; marker represents the group, not an individual facility.'
 for year,count in [('2021–2025',new),('2020–2024',old)]:
  if count is not None:
   label=name
   if year=='2020–2024':label=label.replace('Fort Polk','Fort Johnson').replace('Fort Hood','Fort Cavazos')
   add('military-heat',label,count,lat,lon,year,'heat25' if year=='2021–2025' else 'heat24',region,note=note)
cold=[('Fort Wainwright, AK',64.83,-147.62,335),('JB Elmendorf-Richardson, AK',61.26,-149.68,209),('Camp Lejeune, NC',34.67,-77.36,115),('Fort Carson, CO',38.74,-104.79,104),('USAG Bavaria, Germany',49.70,11.92,85),('Fort Drum, NY',44.05,-75.76,None),('MCRD San Diego, CA',32.74,-117.20,None),('Fort Benning, GA',32.36,-84.95,None),('Fort Campbell, KY',36.66,-87.46,None),('Fort Cavazos, TX',31.13,-97.78,None),('Fort Bragg, NC',35.14,-79.00,None),('Fort Johnson, LA',31.05,-93.21,None),('JB Lewis-McChord, WA',47.10,-122.58,None),('Camp Pendleton, CA',33.30,-117.35,None),('Fort Leonard Wood, MO',37.76,-92.13,None),('Fort Riley, KS',39.10,-96.81,None),('MCB Quantico, VA',38.52,-77.31,None),('Fairchild AFB, WA',47.62,-117.65,None),('Minot AFB, ND',48.42,-101.36,None),('Fort Bliss, TX',31.81,-106.42,None),('JB San Antonio, TX',29.42,-98.62,None),('USAG Humphreys, South Korea',36.97,127.03,None),('MCRD Parris Island, SC',32.35,-80.69,None)]
for name,lat,lon,count in cold:
 add('military-cold',name,count,lat,lon,'Jul 2020–Jun 2025','cold25','Overseas' if 'Germany' in name or 'Korea' in name else 'Alaska / Hawaii' if ', AK' in name else 'CONUS','Cold injury cases','Five-season total. '+('Exact total stated in source narrative.' if count else 'Figure 4 inclusion establishes ≥25 cases; exact five-season count not published in the extracted text. Seasonal bars have not been digitized.'),25 if count is None else None)
japan='''Hokkaido|43.06|141.35|2727
Aomori|40.82|140.74|926
Iwate|39.70|141.15|998
Miyagi|38.27|140.87|1799
Akita|39.72|140.10|699
Yamagata|38.24|140.36|853
Fukushima|37.75|140.47|1698
Ibaraki|36.37|140.47|2442
Tochigi|36.57|139.88|1514
Gunma|36.39|139.06|1958
Saitama|35.86|139.65|6141
Chiba|35.61|140.12|4292
Tokyo|35.68|139.69|9315
Kanagawa|35.44|139.64|4972
Niigata|37.90|139.02|1514
Toyama|36.70|137.21|716
Ishikawa|36.59|136.63|984
Fukui|36.06|136.22|647
Yamanashi|35.66|138.57|691
Nagano|36.65|138.18|1351
Gifu|35.42|136.76|1889
Shizuoka|34.98|138.38|2232
Aichi|35.18|136.91|6653
Mie|34.73|136.51|1648
Shiga|35.02|135.85|1128
Kyoto|35.01|135.77|2301
Osaka|34.69|135.50|7202
Hyogo|34.69|135.18|4610
Nara|34.69|135.83|1542
Wakayama|34.23|135.17|989
Tottori|35.50|134.24|602
Shimane|35.47|133.05|667
Okayama|34.66|133.92|2243
Hiroshima|34.40|132.46|2295
Yamaguchi|34.19|131.47|954
Tokushima|34.07|134.56|756
Kagawa|34.34|134.04|1005
Ehime|33.84|132.77|1459
Kochi|33.56|133.53|707
Fukuoka|33.61|130.42|3808
Saga|33.25|130.30|936
Nagasaki|32.75|129.88|1191
Kumamoto|32.79|130.74|1712
Oita|33.24|131.61|1382
Miyazaki|31.91|131.42|1046
Kagoshima|31.60|130.56|1803
Okinawa|26.21|127.68|1513'''
for line in japan.splitlines():
 name,lat,lon,n=line.split('|');add('japan',name+' prefecture, Japan',int(n),float(lat),float(lon),'May–Sep 2025','japan','Japan','Heat illness ambulance transports','Prefecture-wide transport count. Capital used as display anchor; not a city count or a heat-stroke-only diagnosis.')
india='''Andhra Pradesh|16.5|80.6|97 128 50 22 47
Arunachal Pradesh|27.1|93.6|0 0 0 0 0
Assam|26.1|91.7|0 3 0 0 1
Bihar|25.6|85.1|64 215 53 57 78
Chhattisgarh|21.3|81.6|1 16 3 2 11
Goa|15.5|73.8|0 0 0 0 0
Gujarat|23.2|72.6|31 27 12 8 5
Haryana|29.1|76.1|56 46 23 14 27
Himachal Pradesh|31.1|77.2|0 0 0 1 0
Jharkhand|23.4|85.3|42 88 23 33 47
Karnataka|13.0|77.6|0 4 1 0 2
Kerala|8.5|76.9|1 3 0 0 0
Madhya Pradesh|23.3|77.4|15 33 7 2 27
Maharashtra|19.1|72.9|128 159 56 37 90
Manipur|24.8|93.9|0 0 0 0 0
Meghalaya|25.6|91.9|4 0 0 0 0
Mizoram|23.7|92.7|0 0 0 0 0
Nagaland|25.7|94.1|0 0 0 0 0
Odisha|20.3|85.8|40 84 13 15 38
Punjab|30.9|75.8|38 90 110 91 130
Rajasthan|26.9|75.8|43 54 23 1 12
Sikkim|27.3|88.6|0 1 0 0 0
Tamil Nadu|13.1|80.3|0 0 0 2 2
Telangana|17.4|78.5|107 156 98 43 62
Tripura|23.8|91.3|1 1 2 0 2
Uttar Pradesh|26.8|80.9|176 117 50 35 130
Uttarakhand|30.3|78.0|0 0 0 0 0
West Bengal|22.6|88.4|46 49 6 11 18'''
for line in india.splitlines():
 name,lat,lon,ns=line.split('|')
 for year,n in zip(range(2018,2023),ns.split()):add('india',name+', India',int(n),float(lat),float(lon),str(year),'india','India','Recorded heat / sunstroke deaths','State-wide administrative count; approximate state display anchor, not a death location. Union territories not mapped. Zero is recorded zero, not absence of risk.')
for year,n in zip(range(2021,2026),[339,425,645,608,430]):add('civilian-deaths','Maricopa County, Arizona',n,33.45,-112.07,str(year),'maricopa','United States','Observed heat-related deaths','County-wide heat-caused and heat-contributed deaths, including nonresidents. County display anchor.')
add('civilian-deaths','Spain',25,40.42,-3.70,'Summer 2025','spain','Europe','Confirmed heat-stroke deaths','May 16–September 30. National total anchored at Madrid; not a city count.')
add('modeled-deaths','Spain',3832,40.42,-3.70,'Summer 2025','spain','Europe','Modeled heat-attributable deaths','MoMo statistical estimate, not individually confirmed heat-stroke deaths. May 16–September 30.')
trends=[]
branches=['Army','Navy','Air Force','Marine Corps','Space Force','Coast Guard']
exhaustion=[[1032,215.6,147,43,184,53.8,494,275.4,None,None,5,12.4],[1033,224.3,191,56.5,237,73.8,554,318.5,None,None,19,47.9],[1179,263.1,205,62.7,363,111,491,290.7,7,81.9,6,15.5],[1211,278.4,203,63.2,298,92.8,655,397.5,4,43.4,17,43.2],[1223,274,240,72.3,253,76.2,483,284,5,50.7,29,70.7]]
stroke=[[298,62.3,25,7.3,27,7.9,110,61.3,None,None,0,0],[225,48.8,31,9.2,32,10,134,77,None,None,1,2.5],[234,52.2,36,11,20,6.1,114,67.5,0,0,3,7.7],[247,56.8,41,12.8,38,11.8,144,87.4,0,0,1,2.5],[307,68.8,32,9.6,19,5.7,158,92.9,1,10.1,1,2.4]]
for measure,series in [('Heat exhaustion',exhaustion),('Heat stroke',stroke)]:
 for year,vals in zip(range(2021,2026),series):
  for i,b in enumerate(branches):trends.append(dict(year=year,branch=b,measure=measure,count=vals[2*i],rate=vals[2*i+1],unit='cases per 100,000 person-years',source='heatfull'))
assert sum(r['count'] for r in records if r['layer']=='japan')==100510
assert sum(r['count'] for r in records if r['layer']=='military-heat' and r['period']=='2021–2025')==9839
assert sum(r['count'] for r in records if r['layer']=='military-heat' and r['period']=='2020–2024')==9624
assert [sum(r['count'] for r in records if r['layer']=='india' and r['period']==str(y)) for y in range(2018,2023)]==[890,1274,530,374,729]
data=dict(updated='2026-10-20',records=records,trends=trends,sources=sources,unmapped={'2021–2025':{'overseas_excluding_okinawa':573,'all_other_locations':2635,'total':13047},'2020–2024':{'overseas_excluding_okinawa':510,'all_other_locations':2296,'total':12430}})
(p/'atlas.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
for name,rows in [('observations',records),('military-trends',trends),('sources',sources)]:
 with (p/(name+'.csv')).open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
features=[dict(type='Feature',geometry=dict(type='Point',coordinates=[r['lon'],r['lat']]),properties=r) for r in records]
(p/'observations.geojson').write_text(json.dumps(dict(type='FeatureCollection',features=features),ensure_ascii=False))
print(f'Validated {len(records)} map observations, {len(trends)} branch-year observations, {len(sources)} sources.')
