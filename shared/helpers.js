
window.helpers = {};

(function(){

  //points
  helpers.pointCollideRec = function(x1, y1, x2, y2, h, w){//1 is point, 2 is rec
    //angled rec has another function
    
    let h2 = h/2;
    let w2 = w/2;
    return (x1 >= (x2 - w2) && x1 <= (x2 + w2) && y1 >= (y2 - h2) && y1 <= (y2 + h2));
  }
  helpers.pointCollideCirc = function(x1, y1, x2, y2, r){
    let dx = x2 - x1;
    let dy = y2 - y1;
    return (r*r >= dx * dx + dy * dy);
  }
  helpers.pointCollidePoint = function(x1, y1, x2, y2){
    return helpers.circCollideCirc(x1, y1, 5, x2, y2, 5);//points are small circles of radius 5. todo. better way? no magic number
  }
  helpers.pointCollideLine = function(x1, y1, x21, y21, x22, y22, d, angle){
    //if(debug) console.log('helpers pointCollide Line');

    return helpers.lineCollideCirc(x21, y21, x22, y22, x1, y1, 5);//points are small circles of radius 5. todo. better way? no magic number
  }

  //lines
  helpers.lineCollideCirc = function(x11, y11, x12, y12, x2, y2, r){//d is length of line, angle is line's angle. x12 and y12 or angle and d can be passed in as undefined, but not both
    
    //get x y distance from ends of line to circ center and to each other
    let sx12 = x2 - x11;
    let sy12 = y2 - y11;
    let sx22 = x2 - x12;
    let sy22 = y2 - y12;
    let sx11 = x12 - x11;
    let sy11 = y12 - y11;
    //if(debug) console.log('lineCollideCirc: sx12: ' + sx12.toFixed(3) + ' sy12: ' + sy12.toFixed(3) + ' sx11: ' + sx11 + ' sy11: ' + sy11.toFixed(3) + ' sx22: ' + sx22.toFixed(3) + ' sy22: ' + sy22.toFixed(3) + ' x2: ' + x2.toFixed(3) + ' y2: ' + y2.toFixed(3) + ' x11:' + x11 + ' y11:' + y11 + ' x12:' + x12 + ' y12:' + y12);

    //first check if circ covers the two ends
    if((sx12 * sx12 + sy12 * sy12 <= r * r) || ((sx22 * sx22 + sy22 * sy22 <= r * r))) return true;

    //P(the point on the line P1->P2 that forms the shortest line to P3) = P1 + u(P2-P1)
    let u = (sx12 * sx11 + sy12 * sy11) / (sx11 * sx11 + sy11 * sy11);
    let xi = x11 + u * (sx11);//coor of P
    let yi = y11 + u * (sy11);
    let sxi = xi - x2;//distance from circ center to P
    let syi = yi - y2;

    //if(debug) console.log('helpers lineCollideCirc: u: ' + u.toFixed(3) + ' xi: ' + xi.toFixed(3) + ' yi: ' + yi.toFixed(3) + ' sxi: ' + sxi.toFixed(3) + ' syi: ' + syi.toFixed(3));

    return (u >= 0 && u <= 1) && ((sxi * sxi + syi * syi) <= r * r);//u between 0 and 1 means P is actually on the segment instead of its extension
  }

  helpers.lineCollideRec = function(x11, y11, x12, y12, x2, y2, h, w){//d is length of line, angle is line's angle. x12 and y12 or angle and d can be passed in as undefined, but not both

    if(debug) console.assert(x12 !== undefined && w !== undefined);

    //rec's four corners
    let w2 = w/2;
    let h2 = h/2;
    let x21 = x2 - w2;
    let y21 = y2 - h2;
    let x22 = x2 + w2;
    let y22 = y2 + h2;
    let x23 = x2 + w2;
    let y23 = y2 - h2;
    let x24 = x2 - w2;
    let y24 = y2 + h2;
    //check line intersection with all four sides(rec is not at an angle)
    return helpers.lineCollideLine(x11, y11, x12, y12, x21, y21, x22, y22) ||
      helpers.lineCollideLine(x11, y11, x12, y12, x22, y22, x23, y23) || 
      helpers.lineCollideLine(x11, y11, x12, y12, x23, y23, x24, y24) ||
      helpers.lineCollideLine(x11, y11, x12, y12, x24, y24, x21, y21);
  }

  helpers.lineCollideLine = function(x11, y11, x12, y12, x21, y21, x22, y22) {//line1: xy11->xy12 etc.
    //can be optimized? adapted from http://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect/1968345#1968345
    var s1_x, s1_y, s2_x, s2_y;
    s1_x = x12 - x11;
    s1_y = y12 - y11;
    s2_x = x22 - x21;
    s2_y = y22 - y21;
  
    var s, t;
    s = (-s1_y * (x11 - x21) + s1_x * (y11 - y21)) / (-s2_x * s1_y + s1_x * s2_y);
    t = ( s2_x * (y11 - y21) - s2_y * (x11 - x21)) / (-s2_x * s1_y + s1_x * s2_y);
  
    return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
  }

  //recs
  helpers.recCollideCirc = function(x1, y1, h, w, x2, y2, r){
    h = h/2;
    w = w/2;

    if((x1 - w) > (x2 + r) || (x1 + w) < (x2 - r) || (y1 - h) > (y2 + r) || (y1 + h) < (y2 - r)){return false;}//basic elimination
    if(((x2) <= (x1 + w) && x2 >= (x1 - w)) || (y2 <= (y1 + h) && y2 >= (y1 - h))){return true;}//detect straight vertical or horizontal collision
    //check circle distance to closest corner
    let dx = Math.abs(x2 - x1) - w;
    let dy = Math.abs(y2 - y1) - h;

    return r*r >= dx*dx + dy*dy;
  }
  helpers.recRotateCollidePoint = function(x1, y1, h, w, angle, x2, y2){
    //idea from https://stackoverflow.com/questions/401847/circle-rectangle-collision-detection-intersection

    //this method is more messy. correct the cleaner one
    let phi = Math.atan2(h, w);
    let theta = angle + phi;
    let l = 0.5 * Math.sqrt(h * h + w * w);
    let ya = Math.sin(theta) * l + y1;
    let xa = Math.cos(theta) * l + x1;
    let dyab = Math.sin(-(PI / 2) + angle) * h;
    let dxab = Math.cos(-(PI / 2) + angle) * h;
    let dyad = Math.sin(PI + angle) * w;
    let dxad = Math.cos(PI + angle) * w;
    let dyap = y2 - ya;
    let dxap = x2 - xa;
    let ab = [dxab, dyab];
    let ad = [dxad, dyad];
    let ap = [dxap, dyap];

    return ( (0 <= helpers.dotProduct(ap, ab)) && (helpers.dotProduct(ap, ab) <= helpers.dotProduct(ab, ab)) && (0 <= helpers.dotProduct(ap, ad)) && (helpers.dotProduct(ap, ad) <= helpers.dotProduct(ad, ad)) );
    
    //todo. absolute all three vectors is wrong. fix. ??
    /*
    let dy1a = Math.sin(angle) * (w/2);
    let dx1a = Math.cos(angle) * (w/2);
    let dy1b = Math.sin(angle + PI / 2) * (h/2);
    let dx1b = Math.cos(angle + PI / 2) * (h/2);
    let dy1p = y2 - y1;
    let dx1p = x2 - x1;
    let ap = [Math.abs(dx1p), Math.abs(dy1p)];
    let aa = [Math.abs(dx1a), Math.abs(dy1a)];
    let ab = [Math.abs(dx1b), Math.abs(dy1b)];

    //if(debug) console.log(`recRotateCollidePoint: x1: ${x1} y1: ${y1} h: ${h} w: ${w} angle: ${angle.toFixed(3)} x2: ${x2} y2: ${y2} dy1a: ${~~dy1a} dx1a: ${~~dx1a} dy1b: ${~~dy1b} dx1b: ${~~dx1b} dy1p: ${~~dy1p} dx1p: ${~~dx1p} dotpa: ${~~helpers.dotProduct(ap, aa)} dotaa: ${~~helpers.dotProduct(aa, aa)} dotpb: ${~~helpers.dotProduct(ap, ab)} dorbb: ${~~helpers.dotProduct(ab, ab)} `);

    return ( (0 <= helpers.dotProduct(ap, aa)) && (helpers.dotProduct(ap, aa) <= helpers.dotProduct(aa, aa)) && (0 <= helpers.dotProduct(ap, ab)) && (helpers.dotProduct(ap, ab) <= helpers.dotProduct(ab, ab)) );
    */
  }
  helpers.recCollideRec = function(x1, y1, h1, w1, x2, y2, h2, w2){
    h1 = h1/2;
    w1 = w1/2;
    h2 = h2/2;
    w2 = w2/2;

    if((x1 - w1) > (x2 + w2) || (x1 + w1) < (x2 - w2) || (y1 - h1) > (y2 + h2) || (y1 + h1) < (y2 - h2)){return false;}
    else{return true;}
  }

  //circs
  helpers.circCollideCirc = function(x1, y1, r1, x2, y2, r2){
    let r = r1 + r2;
    let dx = x2 - x1;
    let dy = y2 - y1;
    return (r*r >= dx * dx + dy * dy);
  }

  //others
  helpers.dotProduct = function(v1, v2){//compute dot product of two 2d vectors
    return (v1[0] * v2[0] + v1[1] * v2[1]);
  }
  helpers.randomNumsGenerator = function(size, min, max){
    let range = max - min;
    let list = [];
    for(let i = 0; i < size; i++){
      list[i] = Math.random()*range + min;
    }
    return list;
  }
  helpers.error = function(message){
    console.error(" :: ERROR :: " + message);
  }
  helpers.functionTimer1 = function(func1, func2, iterations){
    let start = Date.now();
    let trueCount1 = 0;
    for(let i = 0; i < iterations; i++){
      let nums = randomNumsGenerator(7, 0, 1000);
      if(func1(nums[0], nums[1], nums[2], nums[3], undefined, undefined, nums[4], nums[5], nums[6])) trueCount1++;
    }
    let time1 = Date.now() - start;

    start = Date.now();
    let trueCount2 = 0;
    for(let i = 0; i < iterations; i++){
      let nums = randomNumsGenerator(7, 0, 1000);
      if(func2(nums[0], nums[1], nums[2], nums[3], undefined, undefined, nums[4], nums[5], nums[6])) trueCount2++;
    }
    let time2 = Date.now() - start;

    console.log('Test result: time1: ' + time1 + ' trueCount1: ' + trueCount1 + ' time2: ' + time2 + ' trueCount2: ' + trueCount2);
  }
  //get changes to character shield value from tool type
  helpers.getShieldValue = function(tool){

    let shield = 0;

    if(tool.wType !== undefined){//if tool is a weapon
      shield = helpers.getWeaponShield(tool.wType);
    }

    return shield    
  }
  helpers.getWeaponWeight = function(wType){
    switch(wType){
      case(Game.enums.WType.fist):
      return 0;

      case(Game.enums.WType.dagger):
      return 5;

      case(Game.enums.WType.katana):
      return 15;
    }
  }
  helpers.getWeaponShield = function(wType){
    switch(wType){
      case(Game.enums.WType.fist):
      return 0;
      
      case(Game.enums.WType.dagger):
      return 0;

      case(Game.enums.WType.katana):
      return 0.1;
    }
  }

})();
