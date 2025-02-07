const log = require("loglevel");
const SQLCase2 = require("./sqls/SQLCase2");
const SQLCase2Wallet = require("./sqls/SQLCase2Wallet");
const SQLCase2Timeline = require("./sqls/SQLCase2Timeline");
const SQLCase1 = require("./sqls/SQLCase1");
const SQLCase1WithZoomTarget = require("./sqls/SQLCase1WithZoomTarget");
const SQLCase1Timeline = require("./sqls/SQLCase1Timeline");
const SQLCase3Timeline = require("./sqls/SQLCase3Timeline");
const SQLCase3 = require("./sqls/SQLCase3");
const SQLCase4 = require("./sqls/SQLCase4");
const SQLZoomTargetCase1V2 = require("./sqls/SQLZoomTargetCase1V2");


class Map{
  constructor(pool){
    this.pool = pool;
  }

  async init(settings){
    console.debug("init map with settings:", settings);
    this.treeid = settings.treeid;
    this.zoomLevel = parseInt(settings.zoom_level);
    this.userid = settings.userid;
    this.clusterRadius = settings.clusterRadius;
    this.mapName = settings.map_name;
    this.bounds = settings.bounds;
    this.wallet = settings.wallet;
    this.flavor = settings.flavor;
    this.token = settings.token;
    this.treeIds = [];
    this.timeline = settings.timeline;
    if(this.treeid){
      /*
       * Single tree map mode
       */
      this.sql = new SQLCase2();
      this.sql.addTreeFilter(this.treeid);

    }else if(this.capture_id){
      this.sql = new SQLCase2();
      this.sql.addUUIDFilter(this.capture_id);
    }else if(this.userid){
      /*
       * User map mode
       */
      //count the trees amount first
      const result = await this.pool.query({
        text: `select count(*) as count from trees where planter_id = ${this.userid}`,
        values:[]
      });
      const treeCount = result.rows[0].count;
      parseInt(treeCount);
      log.warn("count by userId %d, get %s", this.userid, treeCount);
      if(this.zoomLevel > 15){
        this.sql = new SQLCase2();
        this.sql.setBounds(this.bounds);
        this.sql.addFilterByUserId(this.userid);
      }else{
        if(treeCount > 2000){
          this.sql = new SQLCase1WithZoomTarget();
          this.sql.addFilterByUserId(this.userid);
          this.sql.setZoomLevel(this.zoomLevel);
          this.sql.setBounds(this.bounds);
        }else{
          this.sql = new SQLCase3();
          this.sql.setZoomLevel(this.zoomLevel);
          this.sql.addFilterByUserid(this.userid);
          this.sql.setBounds(this.bounds);
        }
      }
    }else if(this.wallet){
      /*
       * wallet map mode
       */
      //count the trees amount first
      const result = await this.pool.query({
        text: `
        SELECT count(wallet.token.id)
        FROM wallet."token" 
        INNER JOIN wallet.wallet ON wallet.wallet.id = wallet.token.wallet_id
        WHERE wallet.wallet.name = '${this.wallet}'
        `,
        values:[]
      });
      const treeCount = result.rows[0].count;
      parseInt(treeCount);
      log.warn("count by userId %d, get %s", this.userid, treeCount);
      if(this.zoomLevel > 15){
        this.sql = new SQLCase2Wallet();
        this.sql.setBounds(this.bounds);
        this.sql.addFilterByWallet(this.wallet);
      }else{
        if(treeCount > 2000){
          this.sql = new SQLCase1WithZoomTarget();
          this.sql.addFilterByWallet(this.wallet);
          this.sql.setZoomLevel(this.zoomLevel);
          this.sql.setBounds(this.bounds);
        }else{
          this.sql = new SQLCase3();
          this.sql.setZoomLevel(this.zoomLevel);
        this.sql.addFilterByWallet(this.wallet);
          this.sql.setBounds(this.bounds);
        }
      }
    }else if(this.mapName){
      /*
       * org map mode
       */
      if(this.zoomLevel > 15){
        this.sql = new SQLCase2();
        this.sql.addFilterByMapName(this.mapName);
        this.sql.setBounds(this.bounds);
      } else if ([12, 13, 14, 15].includes(this.zoomLevel) && this.mapName != 'freetown') {
        this.sql = new SQLCase3();
        this.sql.setZoomLevel(this.zoomLevel);
        this.sql.addFilterByMapName(this.mapName);
        this.sql.setBounds(this.bounds);
      }else{
        this.sql = new SQLCase1WithZoomTarget();
        this.sql.addMapNameFilter(this.mapName);
        this.sql.setBounds(this.bounds);
        this.sql.setZoomLevel(this.zoomLevel);
      }

    }else if(this.timeline){
      if(this.zoomLevel > 15){
        this.sql = new SQLCase2Timeline();
        this.sql.addTimeline(this.timeline);
        this.sql.setBounds(this.bounds);
      } else if ([12, 13, 14, 15].includes(this.zoomLevel) ) {
        this.sql = new SQLCase3Timeline();
        this.sql.setZoomLevel(this.zoomLevel);
        this.sql.setBounds(this.bounds);
        this.sql.addTimeline(this.timeline);
      }else{
        this.sql = new SQLCase1Timeline();
        this.sql.addTimeline(this.timeline);
        this.sql.setBounds(this.bounds);
        this.sql.setZoomLevel(this.zoomLevel);
      }
    }else{
      /*
       * Normal map mode
       */
      if(this.zoomLevel > 15){
        this.sql = new SQLCase2();
        this.sql.setBounds(this.bounds);
      } else if ([12, 13, 14, 15].includes(this.zoomLevel)) {
        this.sql = new SQLCase4();
        this.sql.setBounds(this.bounds)
      }else{
        this.sql = new SQLCase1WithZoomTarget();
        this.sql.setBounds(this.bounds)
        this.sql.setZoomLevel(this.zoomLevel);
      }
    }
    return;
  }

  async getQuery(){
    return this.sql.getQuery();
  }

  async getZoomTargetQuery(){
    if(this.sqlZoomTarget){
      return this.sqlZoomTarget.getQuery();
    }else{
      return undefined;
    }
  }

  async getPoints(){
    const query = await this.getQuery();
    console.log(query);
    const beginTime = Date.now();
    const data = await this.pool.query(query);
    console.log("get points took time:%d ms", Date.now() - beginTime);
    log.warn("get point:", data.rows.length);
    console.log(data.rows.slice(0,2))
    return data.rows;
  }

  async getZoomTargets(){
    const zoomTargetsQuery = await this.getZoomTargetQuery();
    let zoomTargets;
    if(zoomTargetsQuery){
      const beginTime = Date.now();
      const result = await this.pool.query(zoomTargetsQuery);
      console.log("get zoom target took time:%d ms", Date.now() - beginTime);
      console.log('got zoom targets data');
      zoomTargets = result.rows;
    }
    return zoomTargets;
  }
  
}

module.exports = Map;
