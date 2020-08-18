declare var require: any
declare var System: any

import { Injectable } from '@angular/core';
import createAuth0Client from '@auth0/auth0-spa-js';
import Auth0Client from '@auth0/auth0-spa-js/dist/typings/Auth0Client';
import { from, of, Observable, BehaviorSubject, combineLatest, throwError } from 'rxjs';
import { tap, catchError, concatMap, shareReplay } from 'rxjs/operators';
import { Router } from '@angular/router';
import * as env from "../../../ignore/env"
import { HttpClient } from '@angular/common/http';
import { Loader } from 'es-module-loader/core/loader-polyfill.js'


@Injectable({
  providedIn: 'root'
})

export class AuthService {

  // Create an observable of Auth0 instance of client
  auth0Client$ = (from(
    createAuth0Client({
      domain: "wwltp.auth0.com",
      client_id: env.AUTH0_CLIENT_ID,
      redirect_uri: `${window.location.origin}`,
      useRefreshTokens: true
    })
  ) as Observable<Auth0Client>).pipe(
    shareReplay(1), // Every subscription receives the same shared value
    catchError(err => throwError(err))
  );
  // Define observables for SDK methods that return promises by default
  // For each Auth0 SDK method, first ensure the client instance is ready
  // concatMap: Using the client instance, call SDK method; SDK returns a promise
  // from: Convert that resulting promise into an observable
  isAuthenticated$ = this.auth0Client$.pipe(
    concatMap((client: Auth0Client) => from(client.isAuthenticated())),
    tap(res => this.loggedIn = res)
  );
  handleRedirectCallback$ = this.auth0Client$.pipe(
    concatMap((client: Auth0Client) => from(client.handleRedirectCallback()))
  );
  // Create subject and public observable of user profile data
  private userProfileSubject$ = new BehaviorSubject<any>(null);
  userProfile$ = this.userProfileSubject$.asObservable();
  // Create a local property for login status
  loggedIn: boolean = null;

  constructor(private router: Router, private http: HttpClient) {
    // On initial load, check authentication state with authorization server
    // Set up local auth streams if user is already authenticated
    this.localAuthSetup();
    // Handle redirect from Auth0 login
    this.handleAuthCallback();
  }

  // When calling, options can be passed if desired
  // https://auth0.github.io/auth0-spa-js/classes/auth0client.html#getuser
  getUser$(options?): Observable<any> {
    return this.auth0Client$.pipe(
      concatMap((client: Auth0Client) => from(client.getUser(options))),
      tap(user => this.userProfileSubject$.next(user))
    );
  }

  private localAuthSetup() {
    // This should only be called on app initialization
    // Set up local authentication streams
    const checkAuth$ = this.isAuthenticated$.pipe(
      concatMap((loggedIn: boolean) => {
        if (loggedIn) {
          // If authenticated, get user and set in app
          // NOTE: you could pass options here if needed
          return this.getUser$();
        }
        // If not authenticated, return stream that emits 'false'
        return of(loggedIn);
      })
    );
    checkAuth$.subscribe();
  }

  login(redirectPath: string = '/') {
    // A desired redirect path can be passed to login method
    // (e.g., from a route guard)
    // Ensure Auth0 client instance exists
    this.auth0Client$.subscribe((client: Auth0Client) => {
      // Call method to log in
      client.loginWithRedirect({
        redirect_uri: `${window.location.origin}`,
        appState: { target: redirectPath }
      });

    });
  }

  private handleAuthCallback() {
    // Call when app reloads after user logs in with Auth0
    const params = window.location.search;
    if (params.includes('code=') && params.includes('state=')) {
      let targetRoute: string; // Path to redirect to after login processsed
      const authComplete$ = this.handleRedirectCallback$.pipe(
        // Have client, now call method to handle auth callback redirect
        tap(cbRes => {
          // Get and set target redirect route from callback results
          targetRoute = cbRes.appState && cbRes.appState.target ? cbRes.appState.target : '/';
        }),
        concatMap(() => {
          // Redirect callback complete; get user and login status
          return combineLatest([
            this.getUser$(),
            this.isAuthenticated$
          ]);
        })
      );
      // Subscribe to authentication completion observable
      // Response will be an array of user and login status
      authComplete$.subscribe(([user, loggedIn]) => {
        // Redirect to target route after callback processing
        this.router.navigate([targetRoute]);
      });
    }
  }

  logout() {
    // Ensure Auth0 client instance exists
    this.auth0Client$.subscribe((client: Auth0Client) => {
      // Call method to log out
      client.logout({
        client_id: env.AUTH0_CLIENT_ID,
        returnTo: `${window.location.origin}`
      });
    });
  }

  //------------  Auth0 API Management Class ---------------------
  // TODO: migrate from client to server

  id = null;
  authClientToken = null

  getRawToken() {
    this.auth0Client$.subscribe(
      (client: Auth0Client) => {

        // Management API:   
        // Provides access to read, update, and delete user profiles stored in the Auth0 database. 


        //1. try checksession with scopes using SPA and /api/v2/
        // try a facebook audience too if checksession doesnt work.

        //2. try decoding and encoding jwt. "jwt.d.ts"

        //are these returned encoded, decoded, jwt, or what?
        //getTokenSilently() returns access token 
        //getIdTokenClaims()._raw returns an id token


        this.userProfile$.subscribe(res => {
          this.id = res['sub']
          console.log(this.id)
        })


        client.getTokenSilently().then(res => {
          this.authClientToken = res
          console.log(this.authClientToken)
        })

      })

  }//End getRawToken()



  getManagementAPIToken() {
    this.useLoader()
  }

  useLoader() {
    let loader = new Loader()
    var mc = loader.import('auth0').ManagementClient
    let mgmtclient = new mc.ManagementClient({
      domain: "wwltp.auth0.com",
      scope: "read:users read:user_idp_tokens"
    })
    mgmtclient.getUser(this.id,res=>{
      console.log("mgmtClient says "+res)
    })

  }

  // useRequire(){
  //   const management = require('auth0').ManagementClient
  //   var mgmtclient = new management.ManagementClient();
  // }

  // useRequireEnsure() {
  //   require.ensure('../../../node_modules/auth0', require => {

  //     let mc = require('../../../node_modules/auth0')
  //     var management = new mc.ManagementClient({
  //       token: this.authClientToken,
  //       domain: "wwltp.auth0.com",
  //       // clientId: env.AUTH0_CLIENT_ID,
  //       // clientSecret: env.AUTH0_CLIENT_SECRET,
  //       scope: "read:users read:user_idp_tokens",
  // audience:"https://wwltp.auth0.com/api/v2/",
  //       // responseType: "token"
  //     })
  //     management.getUser(this.id, res => {
  //       console.log("management api says: " + res)
  //     })

  //   })
  // }

  // useSysImport() {
  //   System.import("auth0").then(auth0js => {
  //     var management = new auth0js.ManagementClient()
  //   })
  // }

}