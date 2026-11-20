import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeader } from '../../ui/page-header';

@Component({
  selector: 'app-terms',
  imports: [RouterLink, PageHeader],
  templateUrl: './terms.html',
  styleUrl: './legal-page.css',
})
export class Terms {}
