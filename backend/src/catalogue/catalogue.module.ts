import { Module } from '@nestjs/common';
import { CatalogueController } from './catalogue.controller';
import { DishesService } from './dishes.service';
import { OptionGroupsService } from './option-groups.service';
import { OptionsService } from './options.service';

@Module({
  controllers: [CatalogueController],
  providers: [DishesService, OptionsService, OptionGroupsService],
  exports: [DishesService, OptionsService],
})
export class CatalogueModule {}
