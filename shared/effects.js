(function(){

  function Effect(eType, rate, length){
    //rate: amount per time interval, length: time effective
    this.eType = eType;

    this.rate = rate;
    this.length = length;
    this.startTime = Date.now();

    this.update;//called by character updatestats

    switch(eType){
    case(Game.enums.EType.invincible):
    this.invincible();
    break;
    
    }
  }

  Effect.prototype.invincible = function(){
    this.update = this.invincibleUpdate;
  }
  Effect.prototype.invincibleUpdate= function(){
      //todotodo.generalize effect methods?
  }


  Game.Effect = Effect;
})();