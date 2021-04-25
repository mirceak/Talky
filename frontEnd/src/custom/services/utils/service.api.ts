import { Injectable, NgZone } from '@angular/core';
import _Cryptography from '../../../cryptography';

import { TranslateService } from '@ngx-translate/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { ServiceModals } from './service.modals';
import { Router } from '@angular/router';
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ServiceApi {
  lang = 'en';

  public loggedIn = new BehaviorSubject<any>(null);
  public token = new BehaviorSubject<any>(null);
  public sessionToken = new BehaviorSubject<any>(null);
  public decryptedToken = new ReplaySubject<any>();
  public Cryptography: _Cryptography = new _Cryptography(window.crypto);

  constructor(
    public translate: TranslateService,
    public jwtHelper: JwtHelperService,
    public serviceModals: ServiceModals,
    public router: Router,
    public zone: NgZone
  ) {
    this.loggedIn.subscribe(this._loggedIn.bind(this));
  }

  _loggedIn(val: any): void {
    if (!val) {
      this.token.next(null);
      this.sessionToken.next(null);
    }
  }

  async getRequestData(postData: any, token: any): Promise<any> {
    const nextRsa = await this.Cryptography.generateRsaKeys('jwk');
    const rsaEncryptedAes = await this.Cryptography.getRsaEncryptedAesKey(
      token.value.nextRsa
    );
    const aesEncrypted = await this.Cryptography.aesEncrypt(
      JSON.stringify({ data: postData, nextRsa: nextRsa.pubkData }),
      rsaEncryptedAes.aesKey,
      token.value.nextRsa
    );
    return {
      nextRsa,
      rsaEncryptedAes,
      aesEncrypted,
    };
  }

  async decryptServerData(data: any, nextRsa: any, parse = true): Promise<any> {
    return new Promise(async (resolve, reject): Promise<any> => {
      data.rsaEncryptedAes = this.Cryptography.str2ab(data.rsaEncryptedAes);
      data.aesEncrypted = this.Cryptography.str2ab(data.aesEncrypted);
      const decryptedAes = await this.Cryptography.rsaDecrypt(
        data.rsaEncryptedAes,
        nextRsa.privateKey
      );
      const aesKey = await this.Cryptography.importAesKey(decryptedAes);
      let decryptedToken: any = await this.Cryptography.aesDecrypt(
        data.aesEncrypted,
        aesKey,
        nextRsa.pubkData
      );
      if (parse) {
        decryptedToken = JSON.parse(decryptedToken);
        this.token.next(this.jwtHelper.decodeToken(decryptedToken.token));
      }
      resolve({
        decryptedToken,
        decryptedAes,
        aesKey,
      });
    });
  }
}