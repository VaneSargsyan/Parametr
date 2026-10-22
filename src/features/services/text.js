export const serviceBlankRanges=[[9,13],[32,32],[133,133],[160,160],[173,173],[847,847],[1536,1541],[1564,1564],[1757,1757],[1807,1807],[2192,2193],[2274,2274],[4447,4448],[5760,5760],[6068,6069],[6155,6159],[8192,8207],[8232,8239],[8287,8303],[12288,12288],[12644,12644],[65024,65039],[65279,65279],[65440,65440],[65520,65531],[69821,69821],[69837,69837],[78896,78911],[113824,113827],[119155,119162],[917504,921599]];
export function serviceTextNonempty(value){
    return typeof value==='string' && Array.from(value).some(character=>{
        const point=character.codePointAt(0);
        return !serviceBlankRanges.some(([start,end])=>point>=start && point<=end);
    });
}
