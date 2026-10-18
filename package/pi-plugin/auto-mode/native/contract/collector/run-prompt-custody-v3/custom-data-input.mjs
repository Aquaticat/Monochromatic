/** Classify original inputs only after the calling source owner authenticates their provenance. */
export function isCustomDataInput(origin){
  const {source}=origin;
  if(source.inputOrigin==='native-custom-construction')return true;
  if(source.inputOrigin!=='native-agent-input')return false;
  const metadata=JSON.parse(source.inputLocation.metadataJSON);
  return metadata.role==='custom'&&['steer','followUp'].includes(metadata.method);
}
