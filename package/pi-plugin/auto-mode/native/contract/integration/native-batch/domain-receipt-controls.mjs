/** Each receipt contrast invalidates only its actual transport field and position. */
export function alteredContribution({
  control,
  location
}){
 if(control==='copied-system')return (location.field==='messages')&&(location.ordinal===0);
 if(control==='copied-tools')return location.field==='tools';
 if((control==='copied-tool')||(control==='changed-tool'))return (location.field==='tools')&&(location.ordinal===0);
 return Boolean(control);
}
